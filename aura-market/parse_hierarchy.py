import json

with open('extracted_categories_rich.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

categories = []
current_parent = None
current_sub = None

for item in raw_data:
    text = item['text'].strip()
    indent = item['indent']
    style = item['style']
    
    # Heuristic for Parent (Heading3 or 0 indent with a number like "1. Books")
    if indent == 0 and (style == 'Heading3' or (text and text[0].isdigit())):
        name = text.split('. ', 1)[-1] if '. ' in text else text
        current_parent = {
            'name': name,
            'children': []
        }
        categories.append(current_parent)
        current_sub = None
    elif indent == 720 and current_parent is not None:
        current_sub = {
            'name': text,
            'children': []
        }
        current_parent['children'].append(current_sub)
    elif indent == 1440 and current_sub is not None:
        current_sub['children'].append({
            'name': text,
            'children': []
        })
    elif indent == 2160 and current_sub is not None and current_sub['children']:
        # This might be sub-sub-sub, check if needed
        last_child = current_sub['children'][-1]
        last_child['children'].append({
            'name': text,
            'children': []
        })

with open('hierarchical_categories.json', 'w', encoding='utf-8') as f:
    json.dump(categories, f, indent=2)

print("Success: hierarchical_categories.json created")
