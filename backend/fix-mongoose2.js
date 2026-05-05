const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules') filelist = walkSync(filePath, filelist);
    } else if (file.endsWith('.js')) {
      filelist.push(filePath);
    }
  });
  return filelist;
};

const dirs = [
  path.join(__dirname, 'controllers'),
  path.join(__dirname, 'services')
];

let files = [];
dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    files = walkSync(dir, files);
  }
});

let updatedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  let newContent = content.replace(/\], \{ session, ordered: false \}\)/g, '], { session, ordered: true })');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    updatedCount++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Finished updating ${updatedCount} files.`);
