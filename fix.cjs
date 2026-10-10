const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/views/**/*.tsx');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  const modified = content.replace(/(<table[\s\S]*?<\/table>)/g, (match, p1, offset) => {
    const beforeStr = content.substring(Math.max(0, offset - 40), offset);
    if (beforeStr.includes('overflow-x-auto')) return match;
    return `<div className="overflow-x-auto w-full">\n${match}\n</div>`;
  });

  if (modified !== content) {
    fs.writeFileSync(file, modified);
    count++;
    console.log('Modified', file);
  }
});
console.log('Total files modified:', count);
