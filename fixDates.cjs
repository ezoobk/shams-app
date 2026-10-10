const fs = require('fs');
let c = fs.readFileSync('src/views/Estimates/EstimatesView.tsx', 'utf8');

c = c.replace(/import \{ formatCurrency \} from '\.\.\/\.\.\/utils\/formatters';/, "import { formatCurrency, parseDateSafely } from '../../utils/formatters';");
c = c.replace(/new Date\(a\.lastUpdated \|\| a\.id\)/g, 'parseDateSafely(a.lastUpdated || a.id)');
c = c.replace(/new Date\(b\.lastUpdated \|\| b\.id\)/g, 'parseDateSafely(b.lastUpdated || b.id)');
c = c.replace(/new Date\(est\.lastUpdated \|\| est\.id\)/g, 'parseDateSafely(est.lastUpdated || est.id)');

fs.writeFileSync('src/views/Estimates/EstimatesView.tsx', c);
console.log('Fixed');
