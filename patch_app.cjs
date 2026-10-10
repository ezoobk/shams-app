const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add imports
const imports = `import { useEstimates } from './context/EstimatesContext';
import { useWorkOrders } from './context/WorkOrdersContext';
import { useInvoices } from './context/InvoicesContext';
import { useShippingOrders } from './context/ShippingOrdersContext';
import { useLetters } from './context/LettersContext';
`;
content = content.replace('export default function App() {', imports + '\nexport default function App() {');

// 2. Add hooks & logic inside App
const logic = `  const { estimates } = useEstimates();
  const { workOrders } = useWorkOrders();
  const { invoices } = useInvoices();
  const { letters } = useLetters();
  const { shippingOrders } = useShippingOrders();

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
    
    if (tabId === 'estimates') return estimates.filter(isNew).length;
    if (tabId === 'workOrders') return workOrders.filter(isNew).length;
    if (tabId === 'invoices') return invoices.filter(isNew).length + letters.filter(isNew).length + shippingOrders.filter(isNew).length;
    return 0;
  };
`;
content = content.replace('  const isPermitted = hasPermission(activeTab, \'view\');', logic + '\n  const isPermitted = hasPermission(activeTab, \'view\');');

// 3. Replace map
const oldMap = `.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setViewState('list'); setIsSidebarOpen(false); window.scrollTo(0, 0); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium \${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}\`}>
              <item.icon className={\`w-5 h-5 flex-shrink-0 \${activeTab === item.id ? 'text-white' : 'text-slate-400'}\`} /> {item.label}
            </button>
          ))`;

const newMap = `.map(item => {
             const badgeCount = getNewCount(item.id);
             return (
               <button key={item.id} onClick={() => { setActiveTab(item.id); setViewState('list'); setIsSidebarOpen(false); window.scrollTo(0, 0); }} className={\`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-sm font-medium \${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}\`}>
                 <div className="flex items-center gap-3">
                   <item.icon className={\`w-5 h-5 flex-shrink-0 \${activeTab === item.id ? 'text-white' : 'text-slate-400'}\`} /> {item.label}
                 </div>
                 {badgeCount > 0 && (
                   <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center animate-in zoom-in">
                     {badgeCount}
                   </span>
                 )}
               </button>
             );
          })`;

content = content.replace(oldMap, newMap);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated successfully!');
