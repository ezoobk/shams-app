const fs = require('fs');
let c = fs.readFileSync('src/views/Drivers/DriversView.tsx', 'utf8');
c = c.replace(/\\`/g, '`').replace(/\\$/g, '$');
fs.writeFileSync('src/views/Drivers/DriversView.tsx', c);
