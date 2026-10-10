const fs = require('fs');
let c = fs.readFileSync('src/views/Drivers/DriversView.tsx', 'utf8');
c = c.replace(/\\\\\$\\{/g, '${');
c = c.replace(/\\\$\\{/g, '${');
fs.writeFileSync('src/views/Drivers/DriversView.tsx', c);
console.log('Fixed');
