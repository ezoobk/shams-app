const fs = require('fs');
let lines = fs.readFileSync('./src/App.tsx', 'utf8').split('\n');

// Strip from line 884 onwards (SmartTextField + empty lines after print block)
lines = lines.slice(0, 883);

// Append the main JSX render - the sidebar navigation + tab-switching content area
const mainRender = `
  return (
    <div className={\`min-h-screen bg-slate-50 text-slate-900 font-sans flex print:hidden\`} dir="rtl">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20 fixed h-full">
        <div className="p-6 bg-slate-950/50"><h1 className="text-xl font-black text-white flex items-center gap-3"><LayoutDashboard className="w-6 h-6 text-blue-500" /> شمس للمقطورات</h1></div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
            { id: 'estimates', icon: FileText, label: 'التقديرات والعروض' },
            { id: 'workOrders', icon: Factory, label: 'أوامر التصنيع' },
            { id: 'invoices', icon: Archive, label: 'سجل الصادر' },
            { id: 'letters', icon: Mail, label: 'المراسلات' },
            { id: 'customers', icon: Users, label: 'العملاء' },
            { id: 'drivers', icon: Truck, label: 'السائقون' },
            { id: 'materials', icon: Package, label: 'إدارة المواد' },
            { id: 'worksOf', icon: Settings, label: 'أنواع الأعمال' },
            { id: 'estimateCategories', icon: Tags, label: 'تصنيف التقديرات' },
            { id: 'settings', icon: Settings, label: 'الإعدادات العامة' },
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setViewState('list'); window.scrollTo(0, 0); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium \${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}\`}>
              <item.icon className={\`w-5 h-5 \${activeTab === item.id ? 'text-white' : 'text-slate-400'}\`} /> {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 mr-64 min-h-screen">
        <div className="w-full xl:max-w-[1400px] 2xl:max-w-[1800px] mx-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'estimates' && viewState !== 'calculator' && <EstimatesView setViewState={setViewState} />}
          {(activeTab === 'estimates' || activeTab === 'workOrders') && viewState === 'calculator' && <CostCalculatorView setViewState={setViewState} />}
          {activeTab === 'workOrders' && viewState !== 'calculator' && <WorkOrdersView setViewState={setViewState} />}
          {activeTab === 'invoices' && viewState !== 'edit_invoice' && <OutboundLogView setEditingInvoice={setEditingInvoice} setActiveTab={setActiveTab} />}
          {activeTab === 'invoices' && viewState === 'edit_invoice' && editingInvoice && <InvoiceEditorView editingInvoice={editingInvoice} setEditingInvoice={setEditingInvoice} />}
          {activeTab === 'letters' && <LettersView />}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'drivers' && <DriversView />}
          {activeTab === 'materials' && <MaterialsView />}
          {activeTab === 'worksOf' && <WorksOfView selectedWorkId={selectedWorkId} setSelectedWorkId={setSelectedWorkId} />}
          {activeTab === 'estimateCategories' && <EstimateCategoriesView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}
`;

lines.push(mainRender);
fs.writeFileSync('./src/App.tsx', lines.join('\n'));
console.log('Main render added. Total lines:', lines.length);
