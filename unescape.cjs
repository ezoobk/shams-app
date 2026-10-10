const fs = require('fs');
let content = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8');

// The file literally has '\`' instead of '`'
content = content.replace(/\\`/g, '`');
// And '\$' instead of '$'
content = content.replace(/\\\$/g, '$');

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', content);
console.log('Un-escaped!');
