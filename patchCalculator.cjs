const fs = require('fs');
let c = fs.readFileSync('src/views/Estimates/CostCalculatorView.tsx', 'utf8');

if (!c.includes('useAuth')) {
  c = c.replace(/import React.*?from 'react';/, `$& \nimport { useAuth } from '../../context/AuthContext';`);
  c = c.replace(/const \{ estimates/g, `const { hasPermission } = useAuth();\n  $&`);
}

c = c.replace(/const saveEstimate = \(\) => \{/g, "const saveEstimate = () => { \n    if (editingEstimate) { if (!hasPermission(editingContext === 'workOrders' ? 'workOrders' : 'estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); } else { if (!hasPermission(editingContext === 'workOrders' ? 'workOrders' : 'estimates', 'create')) return alert('ليس لديك صلاحية للإضافة'); }\n");

c = c.replace(/const createWorkOrder = \(\) => \{/g, "const createWorkOrder = () => { \n    if (!hasPermission('workOrders', 'create')) return alert('ليس لديك صلاحية لإنشاء أمر تصنيع');\n");

fs.writeFileSync('src/views/Estimates/CostCalculatorView.tsx', c);
console.log('CostCalculatorView patched.');
