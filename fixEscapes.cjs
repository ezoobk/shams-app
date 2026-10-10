const fs = require('fs');

['src/views/Estimates/EstimatesView.tsx', 'src/views/Estimates/CostCalculatorView.tsx'].forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/\\'/g, "'");
  fs.writeFileSync(file, c);
  console.log(file + ' fixed');
});
