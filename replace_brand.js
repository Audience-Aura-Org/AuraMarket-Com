const fs = require('fs');
const path = require('path');

const root = process.cwd();
const IGNORE = ['.git', 'node_modules', 'dist', 'build'];

const textFile = (file) => {
  const binExt = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.zip', '.gz', '.pdf', '.woff', '.woff2', '.ttf', '.otf'];
  return !binExt.includes(path.extname(file).toLowerCase());
};

const replacements = [
  { from: /Auradime/g, to: 'Auradime' },
  { from: /Auradime/g, to: 'Auradime' },
  { from: /auradime\.com/g, to: 'auradime.com' },
  { from: /auradime/g, to: 'auradime' },
  { from: /Auradime —/g, to: 'Auradime —' },
];

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
      for (const r of replacements) content = content.replace(r.from, r.to);
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

console.log('Normalizing brand occurrences across repository...');
walk(root);
console.log(`Done. Files changed: ${changedFiles}`);
