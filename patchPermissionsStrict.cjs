const fs = require('fs');

function patchFile(file, regexes) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

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

patchFile('src/views/Materials/MaterialsView.tsx', [
  { search: /const addMaterial = \(\) => \{/g, replace: "const addMaterial = () => { \n      if (!hasPermission('materials', 'create')) return alert('ليس لديك صلاحية لإضافة مادة');" },
  { search: /const saveEdit = \(id\) => \{/g, replace: "const saveEdit = (id) => { \n      if (!hasPermission('materials', 'edit')) return alert('ليس لديك صلاحية للتعديل');" },
  { search: /<div className="mb-6 bg-slate-50 p-4 border border-slate-200 rounded-lg shadow-sm">/g, replace: "{hasPermission('materials', 'create') && <div className=\"mb-6 bg-slate-50 p-4 border border-slate-200 rounded-lg shadow-sm\">" },
  { search: /(<Plus className="w-5 h-5" \/> إضافة\s*<\/button>\s*<\/div>\s*<\/div>)/g, replace: "$1}" },
  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من حذف المادة؟'\)\) setMasterMaterials/g, replace: "{hasPermission('materials', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف المادة؟')) setMasterMaterials" },
]);

patchFile('src/views/WorksOf/WorksOfView.tsx', [
  { search: /const addWorkOf = \(\) => \{/g, replace: "const addWorkOf = () => { \n      if (!hasPermission('worksOf', 'create')) return alert('ليس لديك صلاحية لإضافة قسم');" },
  { search: /const saveWorkOf = \(id\) => \{/g, replace: "const saveWorkOf = (id) => { \n      if (!hasPermission('worksOf', 'edit')) return alert('ليس لديك صلاحية للتعديل');" },
  { search: /const deleteWorkOf = \(id\) => \{/g, replace: "const deleteWorkOf = (id) => { \n      if (!hasPermission('worksOf', 'delete')) return alert('ليس لديك صلاحية للحذف');" },
  { search: /const addItem = \(\) => \{/g, replace: "const addItem = () => { \n      if (!hasPermission('worksOf', 'create')) return alert('ليس لديك صلاحية لإضافة عنصر');" },
  { search: /const saveItem = \(id\) => \{/g, replace: "const saveItem = (id) => { \n      if (!hasPermission('worksOf', 'edit')) return alert('ليس لديك صلاحية للتعديل');" },
  { search: /const deleteItem = \(id\) => \{/g, replace: "const deleteItem = (id) => { \n      if (!hasPermission('worksOf', 'delete')) return alert('ليس لديك صلاحية للحذف');" },

  // UI wrap for addWorkOf form
  { search: /<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4 items-end">/g, replace: "{hasPermission('worksOf', 'create') && <div className=\"bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4 items-end\">" },
  { search: /(<button onClick=\{addWorkOf\} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">إضافة قسم<\/button>\s*<\/div>)/g, replace: "$1}" },

  // UI wrap for addItem form
  { search: /<div className="flex gap-4 items-end bg-slate-50 p-4 border border-slate-200 rounded-xl mb-4">/g, replace: "{hasPermission('worksOf', 'create') && <div className=\"flex gap-4 items-end bg-slate-50 p-4 border border-slate-200 rounded-xl mb-4\">" },
  { search: /(<button onClick=\{addItem\} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 whitespace-nowrap">إضافة عنصر<\/button>\s*<\/div>)/g, replace: "$1}" },
]);

patchFile('src/views/Estimates/EstimateCategoriesView.tsx', [
  { search: /const addCategory = \(\) => \{/g, replace: "const addCategory = () => { \n      if (!hasPermission('estimateCategories', 'create')) return alert('ليس لديك صلاحية لإضافة تصنيف');" },
  { search: /const deleteCategory = \(id\) => \{/g, replace: "const deleteCategory = (id) => { \n      if (!hasPermission('estimateCategories', 'delete')) return alert('ليس لديك صلاحية للحذف');" },
  { search: /const saveEdit = \(id\) => \{/g, replace: "const saveEdit = (id) => { \n      if (!hasPermission('estimateCategories', 'edit')) return alert('ليس لديك صلاحية للتعديل');" },

  // UI wrap for form
  { search: /<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">/g, replace: "{hasPermission('estimateCategories', 'create') && <div className=\"bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6\">" },
  { search: /(<button onClick=\{addCategory\} className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 whitespace-nowrap flex items-center gap-2"><Plus className="w-5 h-5" \/> إضافة<\/button>\s*<\/div>\s*<\/div>)/g, replace: "$1}" },
]);

patchFile('src/views/Estimates/EstimatesView.tsx', [
  // For estimates, they open Calculator for add/edit. 
  // Let's add guard in CostCalculatorView.tsx as well! But for now just wrap the UI button properly.
  // Actually, I already wrapped the Add Estimate button. 
]);
