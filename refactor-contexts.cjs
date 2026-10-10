const fs = require('fs');
const glob = require('fs').readdirSync('./src/context');

glob.forEach(f => {
  if(!f.endsWith('.tsx')) return;
  let code = fs.readFileSync('./src/context/' + f, 'utf8');
  
  code = code.replace(/import \{ useLocalStorage \} from '\.\.\/hooks\/useLocalStorage';/g, 
    "import { useDatabaseCollection } from '../hooks/useDatabaseCollection';\nimport { useDatabaseObject } from '../hooks/useDatabaseObject';");

  code = code.replace(/useLocalStorage<Customer\[\]>\('shams_customers'/g, "useDatabaseCollection<Customer[]>('customers'");
  code = code.replace(/useLocalStorage<Driver\[\]>\('shams_drivers'/g, "useDatabaseCollection<Driver[]>('drivers'");
  code = code.replace(/useLocalStorage<Estimate\[\]>\('shams_estimates'/g, "useDatabaseCollection<Estimate[]>('estimates'");
  code = code.replace(/useLocalStorage<EstimateCategory\[\]>\('shams_estimateCategories'/g, "useDatabaseCollection<EstimateCategory[]>('estimate_categories'");
  code = code.replace(/useLocalStorage<Invoice\[\]>\('shams_invoices'/g, "useDatabaseCollection<Invoice[]>('invoices'");
  code = code.replace(/useLocalStorage<Invoice\[\]>\('shams_deletedInvoices'/g, "useDatabaseCollection<Invoice[]>('deleted_invoices'");
  code = code.replace(/useLocalStorage<Letter\[\]>\('shams_letters'/g, "useDatabaseCollection<Letter[]>('letters'");
  code = code.replace(/useLocalStorage<MasterMaterial\[\]>\('shams_masterMaterials'/g, "useDatabaseCollection<MasterMaterial[]>('master_materials'");
  code = code.replace(/useLocalStorage<WorksOf\[\]>\('shams_worksOf'/g, "useDatabaseCollection<WorksOf[]>('works_of'");
  code = code.replace(/useLocalStorage<MasterItem\[\]>\('shams_masterItems'/g, "useDatabaseCollection<MasterItem[]>('master_items'");
  code = code.replace(/useLocalStorage<AppSettings>\('shams_appSettings'/g, "useDatabaseObject<AppSettings>('shams_appSettings'");
  code = code.replace(/useLocalStorage<string\[\]>\('shams_savedNotes'/g, "useDatabaseObject<string[]>('shams_savedNotes'");
  code = code.replace(/useLocalStorage<string\[\]>\('shams_savedTerms'/g, "useDatabaseObject<string[]>('shams_savedTerms'");
  code = code.replace(/useLocalStorage\('shams_shippingOrders'/g, "useDatabaseCollection('shipping_orders'");
  code = code.replace(/useLocalStorage<WorkOrder\[\]>\('shams_workOrders'/g, "useDatabaseCollection<WorkOrder[]>('work_orders'");
  
  // Also any generic any[] mappings that I might have missed
  code = code.replace(/useLocalStorage<any\[\]>\('shams_estimates'/g, "useDatabaseCollection<any[]>('estimates'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_estimateCategories'/g, "useDatabaseCollection<any[]>('estimate_categories'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_invoices'/g, "useDatabaseCollection<any[]>('invoices'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_deletedInvoices'/g, "useDatabaseCollection<any[]>('deleted_invoices'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_worksOf'/g, "useDatabaseCollection<any[]>('works_of'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_masterItems'/g, "useDatabaseCollection<any[]>('master_items'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_shippingOrders'/g, "useDatabaseCollection<any[]>('shipping_orders'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_workOrders'/g, "useDatabaseCollection<any[]>('work_orders'");
  code = code.replace(/useLocalStorage<any\[\]>\('shams_cart'/g, "useDatabaseObject<any[]>('shams_cart'");

  fs.writeFileSync('./src/context/' + f, code);
});
console.log('All Contexts updated');
