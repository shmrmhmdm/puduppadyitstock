import json
import re

def col_letter_to_index(col):
    col = re.match(r'([A-Z]+)', col).group(1)
    num = 0
    for c in col:
        num = num * 26 + (ord(c) - ord('A')) + 1
    return num - 1

def build_database():
    db = {
        "pcs": [],
        "monitors": [],
        "peripherals": [],
        "printers": [],
        "other_equipments": [],
        "complaints": [],
        "employees": [],
        "generator": {
            "name": "Mahindra",
            "serial": "N3B24XL29998",
            "capacity": "25 KVA",
            "logs": []
        },
        "purchases": [],
        "ip_allocations": []
    }

    # 1. Parse Register-PC
    with open('parsed_sheets/Register-PC.json', encoding='utf-8') as f:
        pc_rows = json.load(f)
    for r in pc_rows:
        c = r['cells']
        rn = r['row']
        asset_id = c.get('A' + rn)
        if asset_id and str(asset_id).startswith('PGP-SYS-PC'):
            db['pcs'].append({
                "asset_id": asset_id,
                "category": c.get('B' + rn, 'Desktop'),
                "brand": c.get('C' + rn, ''),
                "model": c.get('D' + rn, ''),
                "serial_number": c.get('E' + rn, ''),
                "processor": c.get('F' + rn, ''),
                "ram": c.get('G' + rn, ''),
                "storage": c.get('H' + rn, ''),
                "os": c.get('I' + rn, ''),
                "ip_address": c.get('J' + rn, ''),
                "seat": c.get('K' + rn, ''),
                "employee_name": c.get('L' + rn, ''),
                "office_section": c.get('M' + rn, ''),
                "purchase_date": c.get('N' + rn, ''),
                "warranty_expiry": c.get('O' + rn, ''),
                "is_working": c.get('P' + rn, '1') == '1',
                "status": c.get('Q' + rn, 'Working'),
                "is_complaint": c.get('R' + rn, '0') == '1',
                "device_status": c.get('S' + rn, 'Working'),
                "amc_type": c.get('T' + rn, ''),
                "amc_agency": c.get('U' + rn, '')
            })

    # 2. Parse Register-Monitor
    with open('parsed_sheets/Register-Monitor.json', encoding='utf-8') as f:
        mtr_rows = json.load(f)
    for r in mtr_rows:
        c = r['cells']
        rn = r['row']
        asset_id = c.get('A' + rn)
        if asset_id and str(asset_id).startswith('PGP-SYS-MTR'):
            db['monitors'].append({
                "asset_id": asset_id,
                "category": c.get('B' + rn, 'Monitor'),
                "brand": c.get('C' + rn, ''),
                "model": c.get('D' + rn, ''),
                "serial_number": c.get('E' + rn, ''),
                "specifications": c.get('F' + rn, ''),
                "assigned_seat": c.get('G' + rn, ''),
                "employee_name": c.get('H' + rn, ''),
                "purchase_date": c.get('I' + rn, ''),
                "warranty_expiry": c.get('J' + rn, ''),
                "connected_pc_id": c.get('K' + rn, ''),
                "status": c.get('L' + rn, 'Working')
            })

    # 3. Parse Register-K&M
    with open('parsed_sheets/Register-K&M.json', encoding='utf-8') as f:
        km_rows = json.load(f)
    for r in km_rows:
        c = r['cells']
        rn = r['row']
        asset_id = c.get('A' + rn)
        if asset_id and str(asset_id).startswith('PGP-SYS-KM'):
            db['peripherals'].append({
                "asset_id": asset_id,
                "category": c.get('B' + rn, 'Keyboard/Mouse'),
                "brand": c.get('C' + rn, ''),
                "model": c.get('D' + rn, ''),
                "serial_number": c.get('E' + rn, ''),
                "assigned_seat": c.get('F' + rn, ''),
                "employee_name": c.get('G' + rn, ''),
                "purchase_date": c.get('H' + rn, ''),
                "warranty_expiry": c.get('I' + rn, ''),
                "connected_pc_id": c.get('J' + rn, ''),
                "status": c.get('K' + rn, 'Working')
            })

    # 4. Parse Register-PTR
    with open('parsed_sheets/Register-PTR.json', encoding='utf-8') as f:
        ptr_rows = json.load(f)
    for r in ptr_rows:
        c = r['cells']
        rn = r['row']
        asset_id = c.get('A' + rn)
        if asset_id and str(asset_id).startswith('PGP-SYS-PTR'):
            db['printers'].append({
                "asset_id": asset_id,
                "category": c.get('B' + rn, 'Printer'),
                "brand": c.get('C' + rn, ''),
                "model": c.get('D' + rn, ''),
                "serial_number": c.get('E' + rn, ''),
                "specifications": c.get('F' + rn, ''),
                "toner_cartridge": c.get('G' + rn, ''),
                "assigned_seat": c.get('H' + rn, ''),
                "employee_name": c.get('I' + rn, ''),
                "purchase_date": c.get('J' + rn, ''),
                "warranty_expiry": c.get('K' + rn, ''),
                "connected_pc_id": c.get('L' + rn, ''),
                "status": c.get('M' + rn, 'Working')
            })

    # 5. Parse Other_Equipments
    with open('parsed_sheets/Other_Equipments.json', encoding='utf-8') as f:
        oe_rows = json.load(f)
    for r in oe_rows:
        c = r['cells']
        rn = r['row']
        asset_id = c.get('A' + rn)
        if asset_id and str(asset_id).startswith('PGP-SYS-OE'):
            db['other_equipments'].append({
                "asset_id": asset_id,
                "category": c.get('B' + rn, ''),
                "brand": c.get('C' + rn, ''),
                "model": c.get('D' + rn, ''),
                "serial_number": c.get('E' + rn, ''),
                "details": c.get('F' + rn, ''),
                "section": c.get('G' + rn, ''),
                "status": c.get('H' + rn, 'Working')
            })

    # 6. Parse Complaint_Register
    with open('parsed_sheets/Complaint_Register.json', encoding='utf-8') as f:
        comp_rows = json.load(f)
    for r in comp_rows:
        c = r['cells']
        rn = r['row']
        if rn != '1' and ('B' + rn in c or 'C' + rn in c):
            db['complaints'].append({
                "id": f"CMP-{rn}",
                "pc_asset_id": c.get('B' + rn, c.get('A' + rn, '')),
                "section_name": c.get('C' + rn, ''),
                "date": c.get('D' + rn, ''),
                "complaint_details": c.get('E' + rn, ''),
                "ticket_id": c.get('F' + rn, ''),
                "assisted_date": c.get('G' + rn, ''),
                "solution": c.get('H' + rn, ''),
                "status": c.get('I' + rn, 'Open'),
                "amc_details": c.get('J' + rn, ''),
                "closed_date": c.get('K' + rn, '')
            })

    # 7. Parse Employee_list
    with open('parsed_sheets/Employee_list.json', encoding='utf-8') as f:
        emp_rows = json.load(f)
    for r in emp_rows:
        c = r['cells']
        rn = r['row']
        if rn != '1' and 'B' + rn in c:
            sl_val = c.get('A' + rn) or ''
            sl = str(sl_val).replace('.0', '')
            if sl.isdigit():
                db['employees'].append({
                    "sl_no": int(sl),
                    "seat": str(c.get('B' + rn) or ''),
                    "name": str(c.get('C' + rn) or ''),
                    "designation": str(c.get('D' + rn) or ''),
                    "office": str(c.get('E' + rn) or '')
                })

    # 8. Parse Purchases
    with open('parsed_sheets/Purchases.json', encoding='utf-8') as f:
        pur_rows = json.load(f)
    for r in pur_rows:
        c = r['cells']
        rn = r['row']
        if rn != '1' and 'C' + rn in c:
            sl_val = c.get('A' + rn) or ''
            db['purchases'].append({
                "sl_no": str(sl_val).replace('.0', ''),
                "date": str(c.get('B' + rn) or ''),
                "item": str(c.get('C' + rn) or ''),
                "amount": str(c.get('D' + rn) or ''),
                "vendor": str(c.get('E' + rn) or ''),
                "file_number": str(c.get('F' + rn) or '')
            })

    # 9. Parse Generator
    with open('parsed_sheets/Generator.json', encoding='utf-8') as f:
        gen_rows = json.load(f)
    for r in gen_rows:
        c = r['cells']
        rn = r['row']
        if rn in ['6', '7'] and 'B' + rn in c:
            db['generator']['logs'].append({
                "call_date": c.get('B' + rn, ''),
                "service_details": c.get('C' + rn, ''),
                "running_hours": c.get('D' + rn, ''),
                "service_attended_date": c.get('E' + rn, ''),
                "amount": c.get('F' + rn, ''),
                "remarks": c.get('G' + rn, '')
            })

    # 10. IP allocations
    used_ips = {pc['ip_address']: pc['asset_id'] for pc in db['pcs'] if pc.get('ip_address') and pc['ip_address'].startswith('192.168.0.')}
    for i in range(1, 255):
        ip = f"192.168.0.{i}"
        assigned_to = used_ips.get(ip, None)
        db['ip_allocations'].append({
            "ip": ip,
            "is_assigned": assigned_to is not None,
            "assigned_to": assigned_to
        })

    with open('stock_data.json', 'w', encoding='utf-8') as out:
        json.dump(db, out, ensure_ascii=False, indent=2)

    print(f"Database built successfully!")
    print(f"PCs: {len(db['pcs'])}, Monitors: {len(db['monitors'])}, Peripherals: {len(db['peripherals'])}, Printers: {len(db['printers'])}, Other: {len(db['other_equipments'])}, Employees: {len(db['employees'])}")

if __name__ == '__main__':
    build_database()
