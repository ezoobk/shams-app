const fs = require('fs');

function patchFile(file, regexes) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (!content.includes('useAuth')) {
    content = content.replace(/import React.*?from 'react';/, `$& \nimport { useAuth } from '../../context/AuthContext';`);
  }
  
  if (!content.includes('hasPermission')) {
    content = content.replace(/const \[viewMode/g, `const { hasPermission } = useAuth();\n  $&`);
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

patchFile('src/views/Invoices/OutboundLogView.tsx', [
  { search: /<button onClick=\{\(\) => setPrintData\(\{ type: 'INVOICE', data: inv \}\)\} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" \/><\/button>/g, replace: "{hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className=\"text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded\" title=\"طباعة\"><Printer className=\"w-4 h-4\" /></button>}" },
  
  { search: /<button onClick=\{\(\) => setPrintData\(\{ type: 'SHIPPING_ORDER', data: so \}\)\} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" \/><\/button>/g, replace: "{hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: so })} className=\"text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded\" title=\"طباعة\"><Printer className=\"w-4 h-4\" /></button>}" },

  { search: /\{\!isDeleted && <button onClick=\{\(\) => deleteInvoice\(inv\)\} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded" title="إلغاء الفاتورة"><Trash2 className="w-4 h-4" \/><\/button>\}/g, replace: "{(!isDeleted && hasPermission('invoices', 'delete')) && <button onClick={() => deleteInvoice(inv)} className=\"text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded\" title=\"إلغاء الفاتورة\"><Trash2 className=\"w-4 h-4\" /></button>}" },
]);

console.log("Invoices patched.");
