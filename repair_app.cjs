const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove the bad imports we added
content = content.replace(/import \{ useEstimates \} from '\.\/context\/EstimatesContext';\nimport \{ useWorkOrders \} from '\.\/context\/WorkOrdersContext';\nimport \{ useInvoices \} from '\.\/context\/InvoicesContext';\nimport \{ useShippingOrders \} from '\.\/context\/ShippingOrdersContext';\nimport \{ useLetters \} from '\.\/context\/LettersContext';\n/, '');

// 2. Remove the bad hook calls and useEffect we injected earlier
content = content.replace(/  const \{ estimates \} = useEstimates\(\);\n  const \{ workOrders \} = useWorkOrders\(\);\n  const \{ invoices \} = useInvoices\(\);\n  const \{ letters \} = useLetters\(\);\n  const \{ shippingOrders \} = useShippingOrders\(\);\n\n  const \[lastSeen, setLastSeen\] = useState\(\(\) => \{\n    try \{\n      const stored = localStorage\.getItem\('shams_last_seen'\);\n      return stored \? JSON\.parse\(stored\) : \{\};\n    \} catch \{ return \{\}; \}\n  \}\);\n\n  useEffect\(\(\) => \{\n    setLastSeen\(prev => \{\n      const updated = \{ \.\.\.prev, \[activeTab\]: Date\.now\(\) \};\n      localStorage\.setItem\('shams_last_seen', JSON\.stringify\(updated\)\);\n      return updated;\n    \}\);\n  \}, \[activeTab, estimates, workOrders, invoices, letters, shippingOrders\]\);\n\n  const getNewCount = \(tabId\) => \{\n    if \(activeTab === tabId\) return 0;\n    const timestamp = lastSeen\[tabId\] \|\| 0;\n    const isNew = \(item\) => new Date\(item\.date \|\| item\.lastUpdated \|\| 0\)\.getTime\(\) > timestamp;\n    \n    if \(tabId === 'estimates'\) return estimates\.filter\(isNew\)\.length;\n    if \(tabId === 'workOrders'\) return workOrders\.filter\(isNew\)\.length;\n    if \(tabId === 'invoices'\) return invoices\.filter\(isNew\)\.length \+ letters\.filter\(isNew\)\.length \+ shippingOrders\.filter\(isNew\)\.length;\n    return 0;\n  \};\n/, '');

// 3. Inject the correct badge logic AFTER editingInvoice
const properLogic = `
  const [lastSeen, setLastSeen] = useState(() => {
    try {
      const stored = localStorage.getItem('shams_last_seen');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    setLastSeen(prev => {
      const updated = { ...prev, [activeTab]: Date.now() };
      localStorage.setItem('shams_last_seen', JSON.stringify(updated));
      return updated;
    });
  }, [activeTab, estimates, workOrders, invoices, letters, shippingOrders]);

  const getNewCount = (tabId) => {
    if (activeTab === tabId) return 0;
    const timestamp = lastSeen[tabId] || 0;
    const isNew = (item) => new Date(item.date || item.lastUpdated || 0).getTime() > timestamp;
    
    if (tabId === 'estimates') return (estimates || []).filter(isNew).length;
    if (tabId === 'workOrders') return (workOrders || []).filter(isNew).length;
    if (tabId === 'invoices') return (invoices || []).filter(isNew).length + (letters || []).filter(isNew).length + (shippingOrders || []).filter(isNew).length;
    return 0;
  };
`;

content = content.replace("const [editingInvoice, setEditingInvoice] = useState(null);", "const [editingInvoice, setEditingInvoice] = useState(null);\n" + properLogic);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx repaired successfully!');
