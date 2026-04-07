import xml.etree.ElementTree as ET
import os

xml_path = 'categories_content/word/document.xml'
if os.path.exists(xml_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Namespaces
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    texts = []
    for p in root.findall('.//w:p', ns):
        p_text = ""
        for t in p.findall('.//w:t', ns):
            if t.text:
                p_text += t.text
        if p_text:
            texts.append(p_text)
    
    with open('extracted_categories.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(texts))
    print("Success: extracted_categories.txt created")
else:
    print("Error: document.xml not found")
