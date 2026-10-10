const fs = require('fs');
let c = fs.readFileSync('src/views/Drivers/DriversView.tsx', 'utf8');
c = c.split('\\\\${').join('${');
fs.writeFileSync('src/views/Drivers/DriversView.tsx', c);
console.log('Done');
