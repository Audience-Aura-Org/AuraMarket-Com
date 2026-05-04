import fs from 'fs';
import path from 'path';

const rootDir = 'c:/Users/Zero/Desktop/AuraMarket/web';
const extensions = ['.js', '.jsx', '.css'];

const patterns = [
    { regex: /\buppercase tracking-widest\b/g, replacement: 'tracking-wide' },
    { regex: /\buppercase tracking-wider\b/g, replacement: 'tracking-normal' },
    { regex: /\buppercase tracking-tight\b/g, replacement: 'tracking-tight' },
    { regex: /\buppercase\b/g, replacement: '' },
    { regex: /\bBUY NOW\b/g, replacement: 'Buy Now' },
    { regex: /\bOUT OF STOCK\b/g, replacement: 'Out of Stock' },
    { regex: /\bSOLD OUT\b/g, replacement: 'Sold Out' },
    { regex: /\bLOGIN\b/g, replacement: 'Login' },
    { regex: /\bSIGN OUT\b/g, replacement: 'Sign Out' },
    { regex: /\bDISCOVERY\b/g, replacement: 'Discovery' },
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;

    for (const { regex, replacement } of patterns) {
        newContent = newContent.replace(regex, replacement);
    }

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        return true;
    }
    return false;
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    let count = 0;

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.next') {
                count += walkDir(filePath);
            }
        } else if (extensions.includes(path.extname(file))) {
            if (processFile(filePath)) {
                count++;
            }
        }
    }
    return count;
}

const total = walkDir(rootDir);
console.log(`Processed ${total} files.`);
