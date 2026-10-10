const fs = require('fs');
let patchLines = fs.readFileSync('patch4.cjs', 'utf8').split(/\r?\n/);
const renderBlockCode = patchLines.slice(27, 172).join('\n');

let matLines = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8').split(/\r?\n/);
const returnIdx = matLines.findIndex(l => l.includes('return ('));

matLines.splice(returnIdx, 0, renderBlockCode);

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', matLines.join('\n'));
console.log('Injected render block!');
