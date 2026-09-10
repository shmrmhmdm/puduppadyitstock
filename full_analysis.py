import json
import os

def examine_all():
    sheets = [
        'Dashboard', 'Register-PC', 'Register-Monitor', 'Register-K&M', 
        'Other_Equipments', 'Register-PTR', 'Complaint_Register', 
        'Generator', 'RT-Section', 'Item-Sort', 'Employee_list', 
        'E-waste', 'Purchases', 'ip_address', 'Sheet9'
    ]
    
    analysis = {}
    for s in sheets:
        p = f'parsed_sheets/{s}.json'
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8') as f:
            rows = json.load(f)
        
        valid_rows = []
        for r in rows:
            cells = {k: v for k, v in r['cells'].items() if v is not None and str(v).strip() != '' and str(v) != '#N/A'}
            if cells:
                valid_rows.append({'row': r['row'], 'cells': cells})
        analysis[s] = {
            'total_valid_rows': len(valid_rows),
            'header': valid_rows[0] if valid_rows else {},
            'sample_data': valid_rows[1:6] if len(valid_rows) > 1 else []
        }
        
    with open('full_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)

    print("Analysis complete.")

if __name__ == '__main__':
    examine_all()
