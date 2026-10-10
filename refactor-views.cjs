const fs = require('fs');

const replaceInView = (path) => {
  if (!fs.existsSync(path)) return;
  let code = fs.readFileSync(path, 'utf8');
  
  code = code.replace(/import \{ useLocalStorage \} from '\.\.\/\.\.\/hooks\/useLocalStorage';/g, 
    "import { useDatabaseObject } from '../../hooks/useDatabaseObject';");
  code = code.replace(/import \{ useLocalStorage \} from '\.\/hooks\/useLocalStorage';/g, 
    "import { useDatabaseObject } from './hooks/useDatabaseObject';");
    
  code = code.replace(/useLocalStorage\(/g, "useDatabaseObject(");

  fs.writeFileSync(path, code);
  console.log('Updated view:', path);
};

replaceInView('./src/views/Estimates/EstimatesView.tsx');
replaceInView('./src/views/Invoices/InvoiceEditorView.tsx');
replaceInView('./src/views/Invoices/OutboundLogView.tsx');
replaceInView('./src/views/Letters/LettersView.tsx');
replaceInView('./src/views/WorkOrders/WorkOrdersView.tsx');
replaceInView('./src/App.tsx');
