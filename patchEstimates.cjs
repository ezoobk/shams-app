const fs = require('fs');

function patchFile(file, regexes) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (!content.includes('useAuth')) {
    content = content.replace(/import React.*?from 'react';/, `$& \nimport { useAuth } from '../../context/AuthContext';`);
  }
  
  if (!content.includes('hasPermission')) {
    content = content.replace(/const \{ [^}]* \} = use(?:Estimates|WorkOrders|Invoices)Context\(\);|const \[viewMode/g, `const { hasPermission } = useAuth();\n  $&`);
  }

  regexes.forEach(({ search, replace }) => {
    content = content.replace(search, replace);
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Patched: ' + file);
  } else {
    console.log('No changes: ' + file);
  }
}

// EstimatesView
patchFile('src/views/Estimates/EstimatesView.tsx', [
  { search: /<button onClick=\{\(\) => \{ setEditingEstimate\(null\); setViewState\('calculator'\); \}\} className="bg-blue-600/, replace: "{hasPermission('estimates', 'create') && <button onClick={() => { setEditingEstimate(null); setViewState('calculator'); }} className=\"bg-blue-600" },
  { search: /(إضافة تقدير جديد\s*<\/button>)/, replace: "$1}" },

  { search: /<button onClick=\{\(\) => setPrintData\(\{ type: 'ESTIMATE', data: est \}\)\} className="text-slate-400 hover:text-indigo-600/, replace: "{hasPermission('estimates', 'print') && <button onClick={() => setPrintData({ type: 'ESTIMATE', data: est })} className=\"text-slate-400 hover:text-indigo-600" },
  { search: /(title="طباعة وعرض سريع"><Printer className="w-4 h-4" \/><\/button>)/g, replace: "$1}" },
  
  { search: /<button onClick=\{\(\) => setPrintData\(\{ type: 'ESTIMATE', data: est \}\)\} className="text-slate-400 bg-white border shadow-sm hover:text-indigo-600/, replace: "{hasPermission('estimates', 'print') && <button onClick={() => setPrintData({ type: 'ESTIMATE', data: est })} className=\"text-slate-400 bg-white border shadow-sm hover:text-indigo-600" },

  { search: /<button onClick=\{\(\) => \{ setEditingEstimate\(est\); setViewState\('calculator'\); window.scrollTo\(0, 0\); \}\} className="text-slate-400 hover:text-blue-600/, replace: "{hasPermission('estimates', 'edit') && <button onClick={() => { setEditingEstimate(est); setViewState('calculator'); window.scrollTo(0, 0); }} className=\"text-slate-400 hover:text-blue-600" },
  { search: /(title="تعديل"><Edit className="w-4 h-4" \/><\/button>)/g, replace: "$1}" },
  
  { search: /<button onClick=\{\(\) => \{ setEditingEstimate\(est\); setViewState\('calculator'\); window.scrollTo\(0, 0\); \}\} className="text-slate-400 bg-white border shadow-sm hover:text-blue-600/, replace: "{hasPermission('estimates', 'edit') && <button onClick={() => { setEditingEstimate(est); setViewState('calculator'); window.scrollTo(0, 0); }} className=\"text-slate-400 bg-white border shadow-sm hover:text-blue-600" },

  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من حذف هذا التقدير؟'\)\) setEstimates\(estimates.filter\(e => e.id !== est.id\)\); \}\} className="text-slate-400 hover:text-red-500/, replace: "{hasPermission('estimates', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا التقدير؟')) setEstimates(estimates.filter(e => e.id !== est.id)); }} className=\"text-slate-400 hover:text-red-500" },
  { search: /(title="حذف"><Trash2 className="w-4 h-4" \/><\/button>)/g, replace: "$1}" },
  
  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من حذف هذا التقدير؟'\)\) setEstimates\(estimates.filter\(e => e.id !== est.id\)\); \}\} className="text-slate-400 bg-white border shadow-sm hover:text-red-500/, replace: "{hasPermission('estimates', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا التقدير؟')) setEstimates(estimates.filter(e => e.id !== est.id)); }} className=\"text-slate-400 bg-white border shadow-sm hover:text-red-500" },
]);

console.log("Estimates patched.");
