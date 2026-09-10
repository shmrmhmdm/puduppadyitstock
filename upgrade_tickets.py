import json
from datetime import datetime

def upgrade_tickets():
    with open('stock_data.json', encoding='utf-8') as f:
        db = json.load(f)

    # Initial structured tickets from the real complaints
    initial_tickets = [
        {
            "ticket_id": "TKT-2026-001",
            "vendor_call_no": "ACER-2026-5512",
            "asset_id": "PGP-SYS-PC032",
            "item_name": "Acer Veriton M200-P500 Desktop",
            "office_section": "Principal (Buds School)",
            "reported_by": "Haseena",
            "issue_category": "Hardware Fault",
            "priority": "High",
            "fault_description": "System not powering on. Power button LED blinking amber.",
            "service_provider": "Acer Warranty",
            "date_logged": "2026-05-14",
            "vendor_call_date": "2026-05-14",
            "attended_date": "2026-05-15",
            "technician_name": "Suresh (Acer Engineer)",
            "technician_phone": "9847123456",
            "parts_replaced": "RAM cleaned & re-fixed in Slot 2",
            "resolution": "RAM re-seated and BIOS power settings re-configured. System tested OK.",
            "status": "Closed",
            "closed_date": "2026-05-15",
            "turnaround_days": 1,
            "remarks": "Covered under Acer OEM Warranty"
        },
        {
            "ticket_id": "TKT-2026-002",
            "vendor_call_no": "KEL-2026-0914",
            "asset_id": "PGP-SYS-PC005",
            "item_name": "Acer Veriton M200-H81 Desktop",
            "office_section": "JC5 (Junior Clerk)",
            "reported_by": "AMALRAJ K V",
            "issue_category": "Software / OS",
            "priority": "Medium",
            "fault_description": "System booting extremely slow, frequent OS freezing during office portal access.",
            "service_provider": "Keltron AMC",
            "date_logged": "2026-05-18",
            "vendor_call_date": "2026-05-18",
            "attended_date": "2026-05-18",
            "technician_name": "Praveen (Keltron)",
            "technician_phone": "9447112233",
            "parts_replaced": "None (Software)",
            "resolution": "OS formatted and Windows 10 reinstalled with latest security patches & Panchayath ERP drivers.",
            "status": "Closed",
            "closed_date": "2026-05-18",
            "turnaround_days": 1,
            "remarks": "Covered under Keltron AMC"
        },
        {
            "ticket_id": "TKT-2026-003",
            "vendor_call_no": "CSP/20260704/99667",
            "asset_id": "PGP-SYS-PC025",
            "item_name": "Dell Vostro 3470 Desktop & Printer",
            "office_section": "VEO-2",
            "reported_by": "Vacant / Office Staff",
            "issue_category": "Printer / Scanner",
            "priority": "Medium",
            "fault_description": "Printer communication failure and paper feed sensor error on connected Canon GM4070 printer.",
            "service_provider": "Keltron AMC",
            "date_logged": "2026-06-17",
            "vendor_call_date": "2026-06-17",
            "attended_date": "2026-06-20",
            "technician_name": "Rajesh (Keltron)",
            "technician_phone": "9446789012",
            "parts_replaced": "Paper pickup roller ordered",
            "resolution": "Technician diagnosed paper feed roller wear. Part requisition submitted.",
            "status": "Parts Pending",
            "closed_date": "",
            "turnaround_days": "",
            "remarks": "Call logged with Keltron CSP desk"
        },
        {
            "ticket_id": "TKT-2026-004",
            "vendor_call_no": "KEL-2026-1188",
            "asset_id": "PGP-SYS-PC029",
            "item_name": "Dell Inspiron 3250 Desktop",
            "office_section": "Overseer-2",
            "reported_by": "Vineetha",
            "issue_category": "Hardware Fault",
            "priority": "Critical",
            "fault_description": "Booting Device Not Detected. Hard disk clicking noise and BIOS SMART error.",
            "service_provider": "Keltron AMC",
            "date_logged": "2026-07-24",
            "vendor_call_date": "2026-07-24",
            "attended_date": "2026-07-25",
            "technician_name": "Arun Kumar (Keltron)",
            "technician_phone": "9495123456",
            "parts_replaced": "500GB HDD replaced with 256GB SSD",
            "resolution": "Faulty 500GB Seagate HDD taken by Keltron for RMA replacement. Backup restored.",
            "status": "Closed",
            "closed_date": "2026-07-25",
            "turnaround_days": 1,
            "remarks": "SSD installed and system returned to operation."
        },
        {
            "ticket_id": "TKT-2026-005",
            "vendor_call_no": "CSP/20260810/10452",
            "asset_id": "PGP-SYS-PC033",
            "item_name": "Acer Veriton M200-H81 Desktop",
            "office_section": "Front Office (FO)",
            "reported_by": "Front Office Staff",
            "issue_category": "Hardware Fault",
            "priority": "High",
            "fault_description": "Automatic restarting repeatedly during public token generation, system freezing after 10 minutes of use.",
            "service_provider": "Keltron AMC",
            "date_logged": "2026-08-10",
            "vendor_call_date": "2026-08-10",
            "attended_date": "2026-08-12",
            "technician_name": "Praveen (Keltron)",
            "technician_phone": "9447112233",
            "parts_replaced": "CPU Thermal paste replaced, SMPS under monitoring",
            "resolution": "CPU heatsink cleaned, new thermal paste applied. SMPS capacitors under test.",
            "status": "Vendor Assigned",
            "closed_date": "",
            "turnaround_days": "",
            "remarks": "In progress with Keltron technical team."
        }
    ]

    db['tickets'] = initial_tickets
    db['complaints'] = initial_tickets # Keep backward compatibility

    with open('stock_data.json', 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print("Tickets upgraded successfully! Total tickets:", len(initial_tickets))

if __name__ == '__main__':
    upgrade_tickets()
