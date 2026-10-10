const fs = require('fs');
let c = fs.readFileSync('src/views/Estimates/CostCalculatorView.tsx', 'utf8');

c = c.replace(/const handleSaveClick = \(asNew = false\) => \{/, 
  "const handleSaveClick = (asNew = false) => { \n" +
  "      if (editingEstimate && !asNew) { if (!hasPermission(editingContext?.type === 'workOrder' ? 'workOrders' : 'estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); } \n" +
  "      else { if (!hasPermission(editingContext?.type === 'workOrder' ? 'workOrders' : 'estimates', 'create')) return alert('ليس لديك صلاحية للإضافة'); }\n"
);

fs.writeFileSync('src/views/Estimates/CostCalculatorView.tsx', c);
console.log('Done');
