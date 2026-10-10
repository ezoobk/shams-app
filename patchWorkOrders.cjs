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

// WorkOrdersView
patchFile('src/views/WorkOrders/WorkOrdersView.tsx', [
  { search: /<button onClick=\{\(\) => setPrintData\(\{ type: 'WORK_ORDER', data: item\._wo \}\)\} className="bg-slate-100/g, replace: "{hasPermission('workOrders', 'print') && <button onClick={() => setPrintData({ type: 'WORK_ORDER', data: item._wo })} className=\"bg-slate-100" },
  { search: /(title="طباعة للتصنيع"><Printer className="w-[34]\.?[5]? h-[34]\.?[5]?" \/><\/button>)/g, replace: "$1}" },
  
  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟'\)\) setWorkOrders\(workOrders.filter\(w => w.id !== item._woId\)\); \}\} className="bg-red-50 text-red-500/g, replace: "{hasPermission('workOrders', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟')) setWorkOrders(workOrders.filter(w => w.id !== item._woId)); }} className=\"bg-red-50 text-red-500" },
  { search: /(title="إلغاء الأمر"><Trash2 className="w-[34]\.?[5]? h-[34]\.?[5]?" \/><\/button>)/g, replace: "$1}" },
]);

console.log("WorkOrders patched.");
