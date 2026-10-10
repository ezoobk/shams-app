const fs = require('fs');
const path = require('path');

function patchFile(file, regexes) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Ensure useAuth is imported
  if (!content.includes('useAuth')) {
    content = content.replace(/import React.*?from 'react';/, `$& \nimport { useAuth } from '../../context/AuthContext';`);
  }
  
  // Ensure hasPermission is extracted
  if (!content.includes('hasPermission')) {
    content = content.replace(/const \{ [^}]* \} = use(?:Customers|Drivers|Materials|WorksOf|EstimatesCategories|Estimates|WorkOrders|Print)Context\(\);|const \[viewMode/g, `const { hasPermission } = useAuth();\n  $&`);
  }

  regexes.forEach(({ search, replace }) => {
    content = content.replace(search, replace);
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Patched: ' + file);
  }
}

// Customers
patchFile('src/views/Customers/CustomersView.tsx', [
  { search: /<button onClick=\{addCustomer\} className="bg-blue-600/, replace: "{hasPermission('customers', 'create') && <button onClick={addCustomer} className=\"bg-blue-600" },
  { search: /(إضافة عميل\s*<\/button>)/, replace: "$1}" },
  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من حذف العميل؟'\)\) setCustomers/, replace: "{hasPermission('customers', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف العميل؟')) setCustomers" },
  { search: /(title="حذف".*?<\/button>)/g, replace: "$1}" }
]);

// Drivers
patchFile('src/views/Drivers/DriversView.tsx', [
  { search: /<button onClick=\{handleSaveDriver\} className="bg-blue-600/, replace: "{hasPermission('drivers', 'create') && <button onClick={handleSaveDriver} className=\"bg-blue-600" },
  { search: /(حفظ بيانات السائق\s*<\/button>)/, replace: "$1}" },
  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من حذف السائق؟'\)\) setDrivers/, replace: "{hasPermission('drivers', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف السائق؟')) setDrivers" },
  { search: /(<Trash2 className="w-4 h-4" \/>\s*<\/button>)/g, replace: "$1}" },
  { search: /<button onClick=\{\(\) => startEdit\(driver\)\} className="text-blue-500/, replace: "{hasPermission('drivers', 'edit') && <button onClick={() => startEdit(driver)} className=\"text-blue-500" },
  { search: /(<Edit className="w-4 h-4" \/>\s*<\/button>)/g, replace: "$1}" }
]);

// Materials
patchFile('src/views/Materials/MaterialsView.tsx', [
  { search: /<button onClick=\{addMasterMaterial\} className="bg-blue-600/, replace: "{hasPermission('materials', 'create') && <button onClick={addMasterMaterial} className=\"bg-blue-600" },
  { search: /(إضافة مادة\s*<\/button>)/, replace: "$1}" },
  { search: /<button onClick=\{\(\) => \{ if \(window.confirm\('هل أنت متأكد من حذف المادة؟'\)\) setMasterMaterials/, replace: "{hasPermission('materials', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف المادة؟')) setMasterMaterials" },
  { search: /(title="حذف".*?<\/button>)/g, replace: "$1}" }
]);

// WorksOf
patchFile('src/views/WorksOf/WorksOfView.tsx', [
  { search: /<button onClick=\{addSection\} className="bg-blue-600/, replace: "{hasPermission('worksOf', 'create') && <button onClick={addSection} className=\"bg-blue-600" },
  { search: /(إضافة قسم\s*<\/button>)/, replace: "$1}" },
  { search: /<button onClick=\{\(\) => deleteSection/, replace: "{hasPermission('worksOf', 'delete') && <button onClick={() => deleteSection" },
  { search: /(title="حذف القسم".*?<\/button>)/g, replace: "$1}" }
]);

// EstimateCategories
patchFile('src/views/Estimates/EstimateCategoriesView.tsx', [
  { search: /<button onClick=\{addCategory\} className="bg-blue-600/, replace: "{hasPermission('estimateCategories', 'create') && <button onClick={addCategory} className=\"bg-blue-600" },
  { search: /(إضافة تصنيف\s*<\/button>)/, replace: "$1}" },
  { search: /<button onClick=\{\(\) => deleteCategory/, replace: "{hasPermission('estimateCategories', 'delete') && <button onClick={() => deleteCategory" },
  { search: /(title="حذف".*?<\/button>)/g, replace: "$1}" }
]);

console.log("Script finished.");
