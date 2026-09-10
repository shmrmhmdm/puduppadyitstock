import http.server
import socketserver
import json
import os
import urllib.parse
import urllib.request
import datetime

PORT = 8080
DB_FILE = 'stock_data.json'
CONFIG_FILE = 'config.json'

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "pcs": [], "monitors": [], "peripherals": [], "printers": [],
        "other_equipments": [], "tickets": [], "complaints": [], "employees": [],
        "generator": {"name": "Mahindra", "serial": "N3B24XL29998", "capacity": "25 KVA", "logs": []},
        "purchases": [], "ip_allocations": []
    }

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "google_apps_script_url": "",
        "sheet_id": "1TU8KfFDau1e5A9WdNQ7qG8d5Jt4_9th-dbJjya70YoE",
        "last_synced": None
    }

def save_config(cfg):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

def get_next_ticket_id(tickets):
    year = datetime.datetime.now().year
    prefix = f"TKT-{year}-"
    max_num = 0
    for t in tickets:
        tid = str(t.get('ticket_id', ''))
        if tid.startswith(prefix):
            try:
                num = int(tid.replace(prefix, ''))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
        elif tid.startswith("TKT-"):
            try:
                num = int(tid.split('-')[-1])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"{prefix}{str(max_num + 1).zfill(3)}"

def get_next_asset_id(category, current_items):
    prefix_map = {
        "pcs": "PGP-SYS-PC",
        "monitors": "PGP-SYS-MTR",
        "peripherals": "PGP-SYS-KM",
        "printers": "PGP-SYS-PTR",
        "other_equipments": "PGP-SYS-OE"
    }
    prefix = prefix_map.get(category, "PGP-SYS-ITEM")
    max_num = 0
    for it in current_items:
        aid = str(it.get('asset_id', ''))
        if aid.startswith(prefix):
            try:
                num = int(aid.replace(prefix, ''))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"{prefix}{str(max_num + 1).zfill(3)}"

def recalculate_ips(db):
    used_ips = {}
    for pc in db.get('pcs', []):
        ip = str(pc.get('ip_address', '')).strip()
        if ip and ip.startswith('192.168.0.'):
            used_ips[ip] = pc.get('asset_id')
    
    allocations = []
    for i in range(1, 255):
        ip = f"192.168.0.{i}"
        allocations.append({
            "ip": ip,
            "is_assigned": ip in used_ips,
            "assigned_to": used_ips.get(ip, None)
        })
    db['ip_allocations'] = allocations

def to_bool(val, default=True):
    if val is None or val == '':
        return default
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in ['1', '1.0', 'true', 'yes', 'working']:
        return True
    if s in ['0', '0.0', 'false', 'no', 'complaint']:
        return False
    return default

def ticket_to_sheet_row(t):
    return [
        t.get('ticket_id', ''),
        t.get('vendor_call_no', ''),
        t.get('asset_id', ''),
        t.get('item_name', ''),
        t.get('office_section', ''),
        t.get('reported_by', ''),
        t.get('issue_category', 'Hardware Fault'),
        t.get('priority', 'Medium'),
        t.get('fault_description', ''),
        t.get('service_provider', 'Keltron AMC'),
        t.get('date_logged', ''),
        t.get('vendor_call_date', ''),
        t.get('attended_date', ''),
        t.get('technician_name', ''),
        t.get('technician_phone', ''),
        t.get('parts_replaced', ''),
        t.get('resolution', ''),
        t.get('status', 'Open'),
        t.get('closed_date', ''),
        t.get('turnaround_days', ''),
        t.get('remarks', '')
    ]

def push_to_google_sheets(action, sheet_name, row_data, asset_id=None, employee=None, ticket_id=None):
    """Pushes operations to Google Apps Script Web App asynchronously."""
    cfg = load_config()
    gas_url = cfg.get('google_apps_script_url')
    if not gas_url:
        return
    
    payload = {
        "action": action,
        "sheet": sheet_name,
        "data": row_data,
        "assetId": asset_id,
        "ticketId": ticket_id,
        "employee": employee
    }
    try:
        req = urllib.request.Request(
            gas_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
            method='POST'
        )
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f"Background Google Sheets push notice: {e}")

def get_row_data_for_sheet(category, item_data):
    if category == 'pcs':
        return [
            item_data.get('asset_id'), item_data.get('category'), item_data.get('brand'), item_data.get('model'),
            item_data.get('serial_number'), item_data.get('processor'), item_data.get('ram'), item_data.get('storage'),
            item_data.get('os'), item_data.get('ip_address'), item_data.get('seat'), item_data.get('employee_name'),
            item_data.get('office_section'), item_data.get('purchase_date', ''), item_data.get('warranty_expiry', ''),
            1 if item_data.get('is_working') else 0, item_data.get('status', 'Working'),
            1 if item_data.get('is_complaint') else 0, item_data.get('device_status', 'Working'),
            item_data.get('amc_type', ''), item_data.get('amc_agency', '')
        ]
    elif category == 'monitors':
        return [
            item_data.get('asset_id'), item_data.get('category', 'Monitor'), item_data.get('brand'), item_data.get('model'),
            item_data.get('serial_number'), item_data.get('specifications'), item_data.get('assigned_seat'),
            item_data.get('employee_name'), item_data.get('purchase_date', ''), item_data.get('warranty_expiry', ''),
            item_data.get('connected_pc_id'), item_data.get('status', 'Working')
        ]
    elif category == 'peripherals':
        return [
            item_data.get('asset_id'), item_data.get('category', 'Peripheral'), item_data.get('brand'), item_data.get('model'),
            item_data.get('serial_number'), item_data.get('assigned_seat'), item_data.get('employee_name'),
            item_data.get('purchase_date', ''), item_data.get('warranty_expiry', ''), item_data.get('connected_pc_id'),
            item_data.get('status', 'Working')
        ]
    elif category == 'printers':
        return [
            item_data.get('asset_id'), item_data.get('category', 'Printer'), item_data.get('brand'), item_data.get('model'),
            item_data.get('serial_number'), item_data.get('specifications'), item_data.get('toner_cartridge'),
            item_data.get('assigned_seat'), item_data.get('employee_name'), item_data.get('purchase_date', ''),
            item_data.get('warranty_expiry', ''), item_data.get('connected_pc_id'), item_data.get('status', 'Working')
        ]
    elif category == 'other_equipments':
        return [
            item_data.get('asset_id'), item_data.get('category') or item_data.get('item_name'), item_data.get('brand'),
            item_data.get('model'), item_data.get('serial_number'), item_data.get('details'), item_data.get('section'),
            item_data.get('status', 'Working')
        ]
    return []

def parse_cloud_sheets_data(cloud_data):
    """Parses raw 2D sheet arrays from Google Apps Script into structured database."""
    db = load_db()

    # 1. Parse Register-PC
    if 'Register-PC' in cloud_data:
        pcs = []
        for row in cloud_data['Register-PC'][1:]:
            if len(row) > 0 and str(row[0]).startswith('PGP-SYS-PC'):
                is_work = to_bool(row[15] if len(row) > 15 else True, default=True)
                is_comp = to_bool(row[17] if len(row) > 17 else False, default=False)
                status_val = str(row[16]) if len(row) > 16 and row[16] else ('Working' if is_work else 'Complaint')
                
                if status_val.lower() == 'complaint' or is_comp:
                    is_work = False
                    status_val = 'Complaint'

                pcs.append({
                    'asset_id': str(row[0]),
                    'category': str(row[1]) if len(row) > 1 and row[1] else 'Desktop',
                    'brand': str(row[2]) if len(row) > 2 and row[2] else '',
                    'model': str(row[3]) if len(row) > 3 and row[3] else '',
                    'serial_number': str(row[4]) if len(row) > 4 and row[4] else '',
                    'processor': str(row[5]) if len(row) > 5 and row[5] else '',
                    'ram': str(row[6]) if len(row) > 6 and row[6] else '',
                    'storage': str(row[7]) if len(row) > 7 and row[7] else '',
                    'os': str(row[8]) if len(row) > 8 and row[8] else '',
                    'ip_address': str(row[9]) if len(row) > 9 and row[9] else '',
                    'seat': str(row[10]) if len(row) > 10 and row[10] else '',
                    'employee_name': str(row[11]) if len(row) > 11 and row[11] else '',
                    'office_section': str(row[12]) if len(row) > 12 and row[12] else '',
                    'purchase_date': str(row[13]) if len(row) > 13 and row[13] else '',
                    'warranty_expiry': str(row[14]) if len(row) > 14 and row[14] else '',
                    'is_working': is_work,
                    'status': status_val,
                    'is_complaint': not is_work,
                    'device_status': status_val,
                    'amc_type': str(row[19]) if len(row) > 19 and row[19] else '',
                    'amc_agency': str(row[20]) if len(row) > 20 and row[20] else ''
                })
        if pcs:
            db['pcs'] = pcs

    # 2. Parse Register-Monitor
    if 'Register-Monitor' in cloud_data:
        monitors = []
        for row in cloud_data['Register-Monitor'][1:]:
            if len(row) > 0 and str(row[0]).startswith('PGP-SYS-MTR'):
                monitors.append({
                    'asset_id': str(row[0]),
                    'category': str(row[1]) if len(row) > 1 and row[1] else 'Monitor',
                    'brand': str(row[2]) if len(row) > 2 and row[2] else '',
                    'model': str(row[3]) if len(row) > 3 and row[3] else '',
                    'serial_number': str(row[4]) if len(row) > 4 and row[4] else '',
                    'specifications': str(row[5]) if len(row) > 5 and row[5] else '',
                    'assigned_seat': str(row[6]) if len(row) > 6 and row[6] else '',
                    'employee_name': str(row[7]) if len(row) > 7 and row[7] else '',
                    'purchase_date': str(row[8]) if len(row) > 8 and row[8] else '',
                    'warranty_expiry': str(row[9]) if len(row) > 9 and row[9] else '',
                    'connected_pc_id': str(row[10]) if len(row) > 10 and row[10] else '',
                    'status': str(row[11]) if len(row) > 11 and row[11] else 'Working'
                })
        if monitors:
            db['monitors'] = monitors

    # 3. Parse Register-K&M
    if 'Register-K&M' in cloud_data:
        peripherals = []
        for row in cloud_data['Register-K&M'][1:]:
            if len(row) > 0 and str(row[0]).startswith('PGP-SYS-KM'):
                peripherals.append({
                    'asset_id': str(row[0]),
                    'category': str(row[1]) if len(row) > 1 and row[1] else 'Peripheral',
                    'brand': str(row[2]) if len(row) > 2 and row[2] else '',
                    'model': str(row[3]) if len(row) > 3 and row[3] else '',
                    'serial_number': str(row[4]) if len(row) > 4 and row[4] else '',
                    'assigned_seat': str(row[5]) if len(row) > 5 and row[5] else '',
                    'employee_name': str(row[6]) if len(row) > 6 and row[6] else '',
                    'purchase_date': str(row[7]) if len(row) > 7 and row[7] else '',
                    'warranty_expiry': str(row[8]) if len(row) > 8 and row[8] else '',
                    'connected_pc_id': str(row[9]) if len(row) > 9 and row[9] else '',
                    'status': str(row[10]) if len(row) > 10 and row[10] else 'Working'
                })
        if peripherals:
            db['peripherals'] = peripherals

    # 4. Parse Register-PTR
    if 'Register-PTR' in cloud_data:
        printers = []
        for row in cloud_data['Register-PTR'][1:]:
            if len(row) > 0 and str(row[0]).startswith('PGP-SYS-PTR'):
                printers.append({
                    'asset_id': str(row[0]),
                    'category': str(row[1]) if len(row) > 1 and row[1] else 'Printer',
                    'brand': str(row[2]) if len(row) > 2 and row[2] else '',
                    'model': str(row[3]) if len(row) > 3 and row[3] else '',
                    'serial_number': str(row[4]) if len(row) > 4 and row[4] else '',
                    'specifications': str(row[5]) if len(row) > 5 and row[5] else '',
                    'toner_cartridge': str(row[6]) if len(row) > 6 and row[6] else '',
                    'assigned_seat': str(row[7]) if len(row) > 7 and row[7] else '',
                    'employee_name': str(row[8]) if len(row) > 8 and row[8] else '',
                    'purchase_date': str(row[9]) if len(row) > 9 and row[9] else '',
                    'warranty_expiry': str(row[10]) if len(row) > 10 and row[10] else '',
                    'connected_pc_id': str(row[11]) if len(row) > 11 and row[11] else '',
                    'status': str(row[12]) if len(row) > 12 and row[12] else 'Working'
                })
        if printers:
            db['printers'] = printers

    # 5. Parse Other_Equipments
    if 'Other_Equipments' in cloud_data:
        oe = []
        for row in cloud_data['Other_Equipments'][1:]:
            if len(row) > 0 and str(row[0]).startswith('PGP-SYS-OE'):
                oe.append({
                    'asset_id': str(row[0]),
                    'category': str(row[1]) if len(row) > 1 and row[1] else '',
                    'brand': str(row[2]) if len(row) > 2 and row[2] else '',
                    'model': str(row[3]) if len(row) > 3 and row[3] else '',
                    'serial_number': str(row[4]) if len(row) > 4 and row[4] else '',
                    'details': str(row[5]) if len(row) > 5 and row[5] else '',
                    'section': str(row[6]) if len(row) > 6 and row[6] else '',
                    'status': str(row[7]) if len(row) > 7 and row[7] else 'Working'
                })
        if oe:
            db['other_equipments'] = oe

    # 6. Parse Ticketing_System if present
    if 'Ticketing_System' in cloud_data and len(cloud_data['Ticketing_System']) > 1:
        tickets = []
        for row in cloud_data['Ticketing_System'][1:]:
            if len(row) > 0 and str(row[0]).startswith('TKT-'):
                tickets.append({
                    'ticket_id': str(row[0]),
                    'vendor_call_no': str(row[1]) if len(row) > 1 and row[1] else '',
                    'asset_id': str(row[2]) if len(row) > 2 and row[2] else '',
                    'item_name': str(row[3]) if len(row) > 3 and row[3] else '',
                    'office_section': str(row[4]) if len(row) > 4 and row[4] else '',
                    'reported_by': str(row[5]) if len(row) > 5 and row[5] else '',
                    'issue_category': str(row[6]) if len(row) > 6 and row[6] else 'Hardware Fault',
                    'priority': str(row[7]) if len(row) > 7 and row[7] else 'Medium',
                    'fault_description': str(row[8]) if len(row) > 8 and row[8] else '',
                    'service_provider': str(row[9]) if len(row) > 9 and row[9] else 'Keltron AMC',
                    'date_logged': str(row[10]) if len(row) > 10 and row[10] else '',
                    'vendor_call_date': str(row[11]) if len(row) > 11 and row[11] else '',
                    'attended_date': str(row[12]) if len(row) > 12 and row[12] else '',
                    'technician_name': str(row[13]) if len(row) > 13 and row[13] else '',
                    'technician_phone': str(row[14]) if len(row) > 14 and row[14] else '',
                    'parts_replaced': str(row[15]) if len(row) > 15 and row[15] else '',
                    'resolution': str(row[16]) if len(row) > 16 and row[16] else '',
                    'status': str(row[17]) if len(row) > 17 and row[17] else 'Open',
                    'closed_date': str(row[18]) if len(row) > 18 and row[18] else '',
                    'turnaround_days': str(row[19]) if len(row) > 19 and row[19] else '',
                    'remarks': str(row[20]) if len(row) > 20 and row[20] else ''
                })
        if tickets:
            db['tickets'] = tickets
            db['complaints'] = tickets

    # 7. Parse Employee_list
    if 'Employee_list' in cloud_data:
        employees = []
        for row in cloud_data['Employee_list'][1:]:
            if len(row) > 1 and row[1]:
                sl = str(row[0]).replace('.0', '') if len(row) > 0 and row[0] else str(len(employees)+1)
                employees.append({
                    'sl_no': int(sl) if sl.isdigit() else len(employees)+1,
                    'seat': str(row[1]),
                    'name': str(row[2]) if len(row) > 2 and row[2] else '',
                    'designation': str(row[3]) if len(row) > 3 and row[3] else '',
                    'office': str(row[4]) if len(row) > 4 and row[4] else ''
                })
        if employees:
            db['employees'] = employees

    # 8. Parse Purchases
    if 'Purchases' in cloud_data:
        purchases = []
        for row in cloud_data['Purchases'][1:]:
            if len(row) > 2 and row[2] and str(row[2]).strip() != '':
                purchases.append({
                    'sl_no': str(row[0]).replace('.0', '') if len(row) > 0 and row[0] else str(len(purchases) + 1),
                    'date': str(row[1]) if len(row) > 1 and row[1] else '',
                    'item': str(row[2]) if len(row) > 2 and row[2] else '',
                    'amount': str(row[3]) if len(row) > 3 and row[3] else '',
                    'vendor': str(row[4]) if len(row) > 4 and row[4] else '',
                    'file_number': str(row[5]) if len(row) > 5 and row[5] else ''
                })
        if purchases:
            db['purchases'] = purchases

    # 9. Parse Generator
    if 'Generator' in cloud_data:
        logs = []
        for row in cloud_data['Generator'][5:]:
            if len(row) > 0 and (row[0] or (len(row) > 1 and row[1])):
                logs.append({
                    'call_date': str(row[0]) if len(row) > 0 and row[0] else '',
                    'service_details': str(row[1]) if len(row) > 1 and row[1] else '',
                    'running_hours': str(row[2]) if len(row) > 2 and row[2] else '',
                    'service_attended_date': str(row[3]) if len(row) > 3 and row[3] else '',
                    'amount': str(row[4]) if len(row) > 4 and row[4] else '',
                    'remarks': str(row[5]) if len(row) > 5 and row[5] else ''
                })
        if logs:
            if 'generator' not in db:
                db['generator'] = {"name": "Mahindra", "serial": "N3B24XL29998", "capacity": "25 KVA", "logs": []}
            db['generator']['logs'] = logs

    recalculate_ips(db)
    save_db(db)
    return db

class StockHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/data':
            db = load_db()
            self.send_json({"status": "success", "data": db})
            return

        elif path == '/api/tickets':
            db = load_db()
            self.send_json({"status": "success", "tickets": db.get('tickets', [])})
            return

        elif path == '/api/config':
            cfg = load_config()
            self.send_json({"status": "success", "config": cfg})
            return

        elif path == '/api/export':
            params = urllib.parse.parse_qs(parsed.query)
            cat = params.get('category', ['pcs'])[0]
            db = load_db()
            items = db.get(cat, [])
            self.send_json({"status": "success", "items": items})
            return

        if path == '/' or path == '':
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
        
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_json({"status": "error", "message": "Invalid JSON format"}, 400)
            return

        db = load_db()

        if path == '/api/stock':
            category = payload.get('category', 'pcs')
            item_data = payload.get('item', {})
            
            if category not in db:
                self.send_json({"status": "error", "message": f"Invalid category: {category}"}, 400)
                return

            if not item_data.get('asset_id'):
                item_data['asset_id'] = get_next_asset_id(category, db[category])
            
            if any(it.get('asset_id') == item_data['asset_id'] for it in db[category]):
                self.send_json({"status": "error", "message": f"Asset ID {item_data['asset_id']} already exists!"}, 400)
                return

            db[category].append(item_data)
            if category == 'pcs':
                recalculate_ips(db)
            save_db(db)

            sheet_map = {
                'pcs': 'Register-PC',
                'monitors': 'Register-Monitor',
                'peripherals': 'Register-K&M',
                'printers': 'Register-PTR',
                'other_equipments': 'Other_Equipments'
            }
            row_vals = get_row_data_for_sheet(category, item_data)
            emp_info = {"seat": item_data.get('seat'), "name": item_data.get('employee_name')} if item_data.get('seat') else None
            push_to_google_sheets('add', sheet_map.get(category), row_vals, item_data.get('asset_id'), emp_info)

            self.send_json({"status": "success", "message": "Item added successfully", "item": item_data})
            return

        elif path == '/api/tickets' or path == '/api/complaints':
            ticket = payload.get('ticket') or payload.get('complaint') or {}
            if not ticket.get('ticket_id'):
                ticket['ticket_id'] = get_next_ticket_id(db.get('tickets', []))
            
            if not ticket.get('date_logged'):
                ticket['date_logged'] = datetime.datetime.now().strftime('%Y-%m-%d')
            
            if 'tickets' not in db:
                db['tickets'] = []

            existing_idx = next((i for i, t in enumerate(db['tickets']) if t.get('ticket_id') == ticket['ticket_id']), None)
            if existing_idx is not None:
                db['tickets'][existing_idx] = ticket
            else:
                db['tickets'].insert(0, ticket)

            db['complaints'] = db['tickets']

            # Update associated PC status
            pc_id = ticket.get('asset_id') or ticket.get('pc_asset_id')
            if pc_id:
                for pc in db['pcs']:
                    if pc.get('asset_id') == pc_id:
                        if ticket.get('status') == 'Closed' or ticket.get('status') == 'Resolved':
                            pc['is_complaint'] = False
                            pc['is_working'] = True
                            pc['status'] = 'Working'
                            pc['device_status'] = 'Working'
                        else:
                            pc['is_complaint'] = True
                            pc['is_working'] = False
                            pc['status'] = 'Complaint'
                            pc['device_status'] = 'Complaint'

            save_db(db)

            # Push to Google Sheet Ticketing_System
            row_data = ticket_to_sheet_row(ticket)
            action = 'update_ticket' if existing_idx is not None else 'add_ticket'
            push_to_google_sheets(action, 'Ticketing_System', row_data, ticket_id=ticket.get('ticket_id'))

            self.send_json({"status": "success", "message": "Ticket saved and synchronized successfully", "ticket": ticket})
            return

        elif path == '/api/purchases':
            purchase = payload.get('purchase', {})
            if 'purchases' not in db:
                db['purchases'] = []
            if not purchase.get('sl_no'):
                purchase['sl_no'] = str(len(db['purchases']) + 1)
            db['purchases'].append(purchase)
            save_db(db)

            row_vals = [
                purchase.get('sl_no', ''),
                purchase.get('date', ''),
                purchase.get('item', ''),
                purchase.get('amount', ''),
                purchase.get('vendor', ''),
                purchase.get('file_number', '')
            ]
            push_to_google_sheets('add', 'Purchases', row_vals)

            self.send_json({"status": "success", "message": "Purchase record saved successfully", "purchase": purchase})
            return

        elif path == '/api/generator':
            log = payload.get('log', {})
            if 'generator' not in db:
                db['generator'] = {"name": "Mahindra", "serial": "N3B24XL29998", "capacity": "25 KVA", "logs": []}
            if 'logs' not in db['generator']:
                db['generator']['logs'] = []
            db['generator']['logs'].append(log)
            save_db(db)

            row_vals = [
                log.get('call_date', ''),
                log.get('service_details', ''),
                log.get('running_hours', ''),
                log.get('service_attended_date', log.get('call_date', '')),
                log.get('amount', ''),
                log.get('remarks', '')
            ]
            push_to_google_sheets('add', 'Generator', row_vals)

            self.send_json({"status": "success", "message": "Generator service log saved successfully", "log": log})
            return

        elif path == '/api/employees':
            emp = payload.get('employee', {})
            if not emp.get('sl_no'):
                emp['sl_no'] = len(db['employees']) + 1
            existing_idx = next((i for i, e in enumerate(db['employees']) if e.get('seat') == emp.get('seat')), None)
            if existing_idx is not None:
                db['employees'][existing_idx] = emp
            else:
                db['employees'].append(emp)

            # Cascade employee name update to assigned equipment
            if emp.get('seat') and emp.get('name'):
                for pc in db.get('pcs', []):
                    if pc.get('seat') == emp.get('seat'):
                        pc['employee_name'] = emp.get('name')
                for mon in db.get('monitors', []):
                    if mon.get('assigned_seat') == emp.get('seat'):
                        mon['employee_name'] = emp.get('name')
                for km in db.get('keyboards_mice', []):
                    if km.get('assigned_seat') == emp.get('seat'):
                        km['employee_name'] = emp.get('name')
                for ptr in db.get('printers', []):
                    if ptr.get('assigned_seat') == emp.get('seat'):
                        ptr['employee_name'] = emp.get('name')

            save_db(db)

            # Push to Google Sheets asynchronously
            push_to_google_sheets('update_employee', 'Employee_list', None, employee=emp)

            self.send_json({"status": "success", "message": "Employee saved & synchronized with Google Sheets", "employee": emp})
            return

        elif path == '/api/config':
            cfg = load_config()
            cfg.update(payload)
            save_config(cfg)
            self.send_json({"status": "success", "message": "Config updated", "config": cfg})
            return

        elif path == '/api/sync':
            cfg = load_config()
            gas_url = cfg.get('google_apps_script_url')
            if not gas_url:
                self.send_json({"status": "error", "message": "Google Apps Script URL is not configured yet. Please configure it in Settings."}, 400)
                return

            try:
                req = urllib.request.Request(
                    gas_url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                resp = urllib.request.urlopen(req, timeout=30)
                raw_content = resp.read().decode('utf-8')
                res_data = json.loads(raw_content)

                if res_data.get('status') == 'success' and 'data' in res_data:
                    updated_db = parse_cloud_sheets_data(res_data['data'])
                    cfg['last_synced'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    save_config(cfg)
                    self.send_json({
                        "status": "success",
                        "message": "Successfully synchronized with Google Sheets!",
                        "last_synced": cfg['last_synced'],
                        "data": updated_db
                    })
                else:
                    self.send_json({"status": "error", "message": res_data.get('message', 'Unknown Google Apps Script response')}, 500)
            except Exception as e:
                self.send_json({"status": "error", "message": f"Sync error: {str(e)}"}, 500)
            return

        self.send_json({"status": "error", "message": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
        
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_json({"status": "error", "message": "Invalid JSON format"}, 400)
            return

        db = load_db()

        if path == '/api/stock':
            category = payload.get('category', 'pcs')
            item_data = payload.get('item', {})
            asset_id = item_data.get('asset_id')

            if category not in db:
                self.send_json({"status": "error", "message": f"Invalid category: {category}"}, 400)
                return

            found = False
            for i, it in enumerate(db[category]):
                if it.get('asset_id') == asset_id:
                    db[category][i] = item_data
                    found = True
                    break

            if not found:
                self.send_json({"status": "error", "message": f"Item {asset_id} not found in {category}"}, 404)
                return

            if category == 'pcs':
                recalculate_ips(db)
            save_db(db)

            sheet_map = {
                'pcs': 'Register-PC',
                'monitors': 'Register-Monitor',
                'peripherals': 'Register-K&M',
                'printers': 'Register-PTR',
                'other_equipments': 'Other_Equipments'
            }
            row_vals = get_row_data_for_sheet(category, item_data)
            emp_info = {"seat": item_data.get('seat'), "name": item_data.get('employee_name')} if item_data.get('seat') else None
            push_to_google_sheets('update', sheet_map.get(category), row_vals, asset_id, emp_info)

            self.send_json({"status": "success", "message": "Item updated successfully", "item": item_data})
            return

        elif path == '/api/tickets' or path == '/api/complaints':
            ticket = payload.get('ticket') or payload.get('complaint') or {}
            tid = ticket.get('ticket_id')
            
            if 'tickets' not in db:
                db['tickets'] = []

            found = False
            for i, t in enumerate(db['tickets']):
                if t.get('ticket_id') == tid:
                    db['tickets'][i] = ticket
                    found = True
                    break

            if not found:
                db['tickets'].insert(0, ticket)

            db['complaints'] = db['tickets']

            # Update associated PC status
            pc_id = ticket.get('asset_id') or ticket.get('pc_asset_id')
            if pc_id:
                for pc in db['pcs']:
                    if pc.get('asset_id') == pc_id:
                        if ticket.get('status') in ['Closed', 'Resolved']:
                            pc['is_complaint'] = False
                            pc['is_working'] = True
                            pc['status'] = 'Working'
                            pc['device_status'] = 'Working'
                        else:
                            pc['is_complaint'] = True
                            pc['is_working'] = False
                            pc['status'] = 'Complaint'
                            pc['device_status'] = 'Complaint'

            save_db(db)

            row_data = ticket_to_sheet_row(ticket)
            push_to_google_sheets('update_ticket', 'Ticketing_System', row_data, ticket_id=tid)

            self.send_json({"status": "success", "message": "Ticket updated successfully", "ticket": ticket})
            return

        self.send_json({"status": "error", "message": "Endpoint not found"}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        db = load_db()

        if path == '/api/tickets':
            tid = params.get('ticket_id', [None])[0]
            if not tid:
                self.send_json({"status": "error", "message": "ticket_id is required"}, 400)
                return
            db['tickets'] = [t for t in db.get('tickets', []) if t.get('ticket_id') != tid]
            db['complaints'] = db['tickets']
            save_db(db)
            self.send_json({"status": "success", "message": f"Ticket {tid} deleted"})
            return

        category = params.get('category', ['pcs'])[0]
        asset_id = params.get('asset_id', [None])[0]

        if not asset_id:
            self.send_json({"status": "error", "message": "asset_id query param is required"}, 400)
            return

        if category not in db:
            self.send_json({"status": "error", "message": f"Invalid category: {category}"}, 400)
            return

        initial_len = len(db[category])
        db[category] = [it for it in db[category] if it.get('asset_id') != asset_id]

        if len(db[category]) == initial_len:
            self.send_json({"status": "error", "message": f"Item {asset_id} not found"}, 404)
            return

        if category == 'pcs':
            recalculate_ips(db)
        save_db(db)
        self.send_json({"status": "success", "message": f"Item {asset_id} removed successfully"})

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), StockHandler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == '__main__':
    run_server()
