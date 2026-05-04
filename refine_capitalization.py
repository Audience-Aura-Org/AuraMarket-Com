import os
import re

root_dir = r'c:\Users\Zero\Desktop\AuraMarket\web'
extensions = ('.js', '.jsx', '.css')

patterns = [
    (r'\buppercase tracking-widest\b', 'tracking-wide'),
    (r'\buppercase tracking-wider\b', 'tracking-normal'),
    (r'\buppercase tracking-tight\b', 'tracking-tight'),
    (r'\buppercase\b', ''),
    (r'\bBUY NOW\b', 'Buy Now'),
    (r'\bOUT OF STOCK\b', 'Out of Stock'),
    (r'\bSOLD OUT\b', 'Sold Out'),
    (r'\bLOGIN\b', 'Login'),
    (r'\bSIGN OUT\b', 'Sign Out'),
    (r'\bDISCOVERY\b', 'Discovery'),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, replacement in patterns:
        new_content = re.sub(pattern, replacement, new_content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

count = 0
for subdir, dirs, files in os.walk(root_dir):
    if 'node_modules' in subdir or '.next' in subdir:
        continue
    for file in files:
        if file.endswith(extensions):
            if process_file(os.path.join(subdir, file)):
                count += 1

print(f"Processed {count} files.")
