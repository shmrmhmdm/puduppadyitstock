import json

def analyze():
    with open('parsed_sheets/Register-PC.json', encoding='utf-8') as f:
        pc_data = json.load(f)

    with open('pc_list.txt', 'w', encoding='utf-8') as out:
        out.write(f"Total rows in Register-PC: {len(pc_data)}\n\n")
        for r in pc_data:
            cells = r['cells']
            r_num = r['row']
            if 'A' + r_num in cells:
                asset_id = cells.get('A' + r_num, '')
                item = cells.get('B' + r_num, '')
                brand = cells.get('C' + r_num, '')
                model = cells.get('D' + r_num, '')
                serial = cells.get('E' + r_num, '')
                proc = cells.get('F' + r_num, '')
                ram = cells.get('G' + r_num, '')
                storage = cells.get('H' + r_num, '')
                os = cells.get('I' + r_num, '')
                ip = cells.get('J' + r_num, '')
                seat = cells.get('K' + r_num, '')
                emp = cells.get('L' + r_num, '')
                sec = cells.get('M' + r_num, '')
                p_date = cells.get('N' + r_num, '')
                is_working = cells.get('P' + r_num, '')
                present_status = cells.get('Q' + r_num, '')
                is_complaint = cells.get('R' + r_num, '')
                dev_status = cells.get('S' + r_num, '')
                maint = cells.get('T' + r_num, '')
                agency = cells.get('U' + r_num, '')
                
                out.write(f"{r_num}. {asset_id} | {item} | {brand} {model} | S/N:{serial} | {proc} / {ram} / {storage} / {os} | IP:{ip} | Seat:{seat} | Emp:{emp} | Sec:{sec} | Work:{is_working}/Comp:{is_complaint} ({present_status or dev_status}) | {maint} - {agency}\n")

if __name__ == '__main__':
    analyze()
