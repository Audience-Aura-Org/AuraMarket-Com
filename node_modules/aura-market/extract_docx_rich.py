import xml.etree.ElementTree as ET
import os

xml_path = 'categories_content/word/document.xml'
if os.path.exists(xml_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Namespaces
    ns = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    }
    
    data = []
    for p in root.findall('.//w:p', ns):
        # Get text
        p_text = ""
        for t in p.findall('.//w:t', ns):
            if t.text:
                p_text += t.text
        
        if not p_text.strip():
            continue
            
        # Try to find style or indentation
        pPr = p.find('w:pPr', ns)
        style = ""
        indent = 0
        
        if pPr is not None:
            pStyle = pPr.find('w:pStyle', ns)
            if pStyle is not None:
                style = pStyle.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
            
            ind = pPr.find('w:ind', ns)
            if ind is not None:
                # Left indentation
                left = ind.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left')
                if left:
                    indent = int(left)
                    
        data.append({'text': p_text, 'style': style, 'indent': indent})
    
    import json
    with open('extracted_categories_rich.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print("Success: extracted_categories_rich.json created")
else:
    print("Error: document.xml not found")
