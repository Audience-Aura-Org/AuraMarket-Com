const fs = require('fs');
const path = require('path');

const root = process.cwd();
const IGNORE = ['.git', 'node_modules', 'dist', 'build', '.next'];

const textFile = (file) => {
  const binExt = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.zip', '.gz', '.pdf', '.woff', '.woff2', '.ttf', '.otf'];
  return !binExt.includes(path.extname(file).toLowerCase());
};

let changedFiles = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (IGNORE.includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    if (!textFile(full)) continue;
    try {
      let content = fs.readFileSync(full, 'utf8');
      let original = content;
      
      // Replace "Auradime" with "Aura Dime" EXCEPT in URLs/emails
      content = content.replace(/Auradime/g, (match, offset, str) => {
        // Check if it's part of a URL or email
        const before = str.substring(Math.max(0, offset - 20), offset);
        const after = str.substring(offset + match.length, Math.min(str.length, offset + match.length + 20));
        
        // Don't replace if it's in a URL or email context
        if (/[:/]/.test(before) || /@/.test(before) || /[.com|.org]/.test(after) || /mailto:/.test(before)) {
          return match; // Keep original
        }
        
        return 'Aura Dime';
      });
      
      if (content !== original) {
        fs.writeFileSync(full, content, 'utf8');
        console.log('Updated:', path.relative(root, full));
        changedFiles++;
      }
    } catch (err) {
      // skip binary or unreadable files
    }
  }
}

console.log('Converting Auradime -> Aura Dime (except URLs)...');
walk(root);
console.log(`Done. Files changed: ${changedFiles}`);
