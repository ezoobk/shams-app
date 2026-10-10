const fs = require('fs');
let lines = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8').split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('<div className="overflow-hidden rounded-lg border border-slate-200">'));
const endIdx = lines.findLastIndex(l => l.trim() === '</div>' && lines[lines.indexOf(l) + 1] && lines[lines.indexOf(l) + 1].trim() === '</div>');

console.log('startIdx', startIdx);
console.log('endIdx', endIdx);
