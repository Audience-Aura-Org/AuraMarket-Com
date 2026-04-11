const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('web/app/admin', processFile);
walkDir('web/app/vendor', processFile);
walkDir('web/app/logistics', processFile);
// Also the wallet
walkDir('web/app/wallet', processFile);

function processFile(filePath) {
  if (!filePath.endsWith('page.js')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Find <header> blocks
  // A simple regex might not work cleanly due to nesting, but let's try 
  // replacing bg-[var(--bg-primary)]/XX with bg-[var(--nav-bg)]
  // But ONLY on the <header className="..."> line.
  
  content = content.replace(/<header className="([^"]+)"/g, (match, classes) => {
    let newClasses = classes
      .replace(/bg-\[var\(--bg-primary\)](\/\d+|)/g, 'bg-[var(--nav-bg)]')
      .replace(/border-\[var\(--glass-border\)]/g, 'border-[var(--nav-border)]')
      .replace(/text-\[var\(--text-primary\)]/g, 'text-[var(--nav-text)]');
      
    // Add text-[var(--nav-text)] if it doesn't exist
    if (!newClasses.includes('text-[var(--nav-text)]')) {
      newClasses += ' text-[var(--nav-text)]';
    }
    return `<header className="${newClasses}"`;
  });

  // Now, what about the elements INSIDE the header? 
  // We can't regex replace them easily without breaking the rest of the file.
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}
