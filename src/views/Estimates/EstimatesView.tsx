import React, { useState, useEffect, useRef } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useCustomers } from '../../context/CustomersContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Calculator, Plus, Trash2, Edit, Save, FileText, Check, Printer, X, Eye, EyeOff, LayoutDashboard, Database, Tags, ArrowUp, ArrowDown, Grid, List, Search, ShoppingCart, Factory, FilterX, Paperclip } from 'lucide-react';
import { formatCurrency, numberToArabicWords, parseDateSafely } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';

export const EstimatesView = ({ setViewState, setActiveTab, setTabStates, setEditingInvoice }: any) => {
    const { estimates, setEstimates, estimateCategories, cart, setCart, setEditingEstimate, setEditingContext } = useEstimates();
    const { generateId } = useSettings();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { customers } = useCustomers();
    const { setPrintData } = usePrint();

    const { hasPermission } = useAuth();
    const [viewMode, setViewMode] = useLocalStorage('shams_estimates_view_mode', 'card');
    const [viewingAttachmentsFor, setViewingAttachmentsFor] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useLocalStorage('est_searchTerm', '');
    const [filterCategory, setFilterCategory] = useLocalStorage('est_filterCat', '');
    const [filterDesc, setFilterDesc] = useLocalStorage('est_filterDesc', '');
    const [filterLength, setFilterLength] = useLocalStorage('est_filterLen', '');
    const [filterWidth, setFilterWidth] = useLocalStorage('est_filterWid', '');
    const [filterHeight, setFilterHeight] = useLocalStorage('est_filterHei', '');
    const [proformaCustomer, setProformaCustomer] = useLocalStorage('est_profCust', '');
    const [sortBy, setSortBy] = useLocalStorage('est_sortBy', 'date');
    const uniqueDescriptions = Array.from(new Set(estimates.map(e => e.desc).filter(Boolean)));

    useEffect(() => {
      const handler = e => {
        if (e.key === 'Escape') {
          const currentTab = window.localStorage.getItem('shams_activeTab')?.replace(/"/g, '');
          if (currentTab !== 'estimates') return;
          if (cart.length > 0) setCart([]);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [cart]);

    const filteredEstimates = [...estimates]
      .filter(e =>
        (e.desc && e.desc.includes(searchTerm)) ||
        (e.chassis && e.chassis.includes(searchTerm)) ||
        (e.notes && e.notes.includes(searchTerm))
      )
      .filter(e => filterCategory === '' || e.categoryId === filterCategory)
      .filter(e => filterDesc === '' || (e.desc && e.desc.includes(filterDesc)))
      .filter(e => filterLength === '' || Number(e.length) === Number(filterLength))
      .filter(e => filterWidth === '' || Number(e.width) === Number(filterWidth))
      .filter(e => filterHeight === '' || Number(e.height) === Number(filterHeight))
      .sort((a, b) => {
        if (sortBy === 'price') return b.sellPrice - a.sellPrice;
        const dateA = parseDateSafely(a.date || a.lastUpdated || a.id).getTime();
        const dateB = parseDateSafely(b.date || b.lastUpdated || b.id).getTime();
        return dateB - dateA;
      });

    const addToCart = (estimate) => {
      const existing = cart.find(c => c.id === estimate.id);
      if (existing) setCart(cart.map(c => c.id === estimate.id ? { ...c, requestedQty: c.requestedQty + 1 } : c));
      else setCart([...cart, { ...JSON.parse(JSON.stringify(estimate)), requestedQty: 1 }]);
    };

    const handleCreateWorkOrder = () => {
      if (cart.length === 0) return;
      const newWOs = [];
      cart.forEach(cartItem => {
        for (let i = 0; i < cartItem.requestedQty; i++) {
          newWOs.push({
            id: generateId('wo'),
            date: new Date().toISOString(),
            items: [{
              ...cartItem,
              serialNumber: generateId('sn'),
              status: 'قيد التصنيع'
            }]
          });
        }
      });
      setWorkOrders([...newWOs, ...workOrders]);
      setCart([]);
      setActiveTab('workOrders');
    };

    const handleCreateProforma = () => {
      if (cart.length === 0) return alert('السلة فارغة.');
      if (!proformaCustomer) return alert('الرجاء اختيار العميل.');

      const customer = customers.find(c => c.id === proformaCustomer);
      const subtotal = cart.reduce((sum, item) => sum + (item.sellPrice * item.requestedQty), 0);
      const newInvoice = {
        isDraft: true,
        type: 'مبدئية',
        customerName: customer?.name || proformaCustomer,
        items: [...cart],
        total: subtotal,
        discount: 0,
        netTotal: subtotal
      };
      setEditingInvoice(newInvoice);
      setCart([]);
      setProformaCustomer('');
      setActiveTab('invoices');
      setTabStates(prev => ({ ...prev, invoices: 'edit_invoice' }));
    };

    return (
      <div className="relative pb-40">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">التقديرات المتاحة</h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-700'}`} title="عرض بطاقات"><Grid className="w-5 h-5" /></button>
              <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-700'}`} title="عرض كجدول"><List className="w-5 h-5" /></button>
            </div>
            {hasPermission('estimates', 'create') && <button onClick={() => { setEditingEstimate(null); setViewState('calculator'); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm"><Plus className="w-5 h-5" /> إضافة تقدير جديد</button>}
          </div>
        </div>

        <div className="mb-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 mr-2" />
            <input type="text" placeholder="ابحث بالوصف، الشاصية، أو الملاحظات..." className="w-full bg-transparent outline-none p-1" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-red-500 mr-2 p-1"><X className="w-5 h-5" /></button>}
          </div>
          <select className="border border-slate-200 rounded-lg p-2 bg-white shadow-sm outline-none w-full md:w-48 text-slate-700 font-medium shrink-0" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">ترتيب حسب: الأحدث</option>
            <option value="price">ترتيب حسب: السعر (الأعلى)</option>
          </select>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-bold text-slate-700">تصفية سريعة:</span>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">التصنيف:</label>
            <select className="w-32 outline-none bg-transparent font-bold text-slate-800 text-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">الكل</option>
              {estimateCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">المنتج:</label>
            <input type="text" list="desc-filters" placeholder="اختر للتصفية..." className="w-32 outline-none bg-transparent font-bold text-slate-800 text-sm" value={filterDesc} onChange={e => setFilterDesc(e.target.value)} />
            <datalist id="desc-filters">
              {uniqueDescriptions.map((desc, i) => <option key={i} value={desc} />)}
            </datalist>
            {filterDesc && <button onClick={() => setFilterDesc('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">الطول (م):</label>
            <input type="number" className="w-16 outline-none bg-transparent text-center font-bold text-slate-800" value={filterLength} onChange={e => setFilterLength(e.target.value)} />
            {filterLength && <button onClick={() => setFilterLength('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">العرض (م):</label>
            <input type="number" className="w-16 outline-none bg-transparent text-center font-bold text-slate-800" value={filterWidth} onChange={e => setFilterWidth(e.target.value)} />
            {filterWidth && <button onClick={() => setFilterWidth('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">الارتفاع (م):</label>
            <input type="number" className="w-16 outline-none bg-transparent text-center font-bold text-slate-800" value={filterHeight} onChange={e => setFilterHeight(e.target.value)} />
            {filterHeight && <button onClick={() => setFilterHeight('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>

          {(searchTerm || filterCategory || filterDesc || filterLength || filterWidth || filterHeight || sortBy !== 'date') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterCategory('');
                setFilterDesc('');
                setFilterLength('');
                setFilterWidth('');
                setFilterHeight('');
                setSortBy('date');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-bold transition-colors shrink-0"
              title="تفريغ التصفية والترتيب"
            >
              <FilterX className="w-4 h-4" /> تصفية البحث
            </button>
          )}
        </div>

        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredEstimates.map(est => (
              <div key={est.id} onDoubleClick={() => { if(!hasPermission('estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); setEditingEstimate(est); setViewState('calculator'); window.scrollTo(0, 0); }} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{est.desc}</h3>
                    <div className="text-xs text-slate-400 mt-1">آخر تحديث: {parseDateSafely(est.lastUpdated || est.date || est.id).toLocaleString('ar-LY')}</div>
                  </div>
                  <div className="flex gap-2" onDoubleClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(est); }} className="text-emerald-600 hover:text-emerald-700 p-2 bg-emerald-50 rounded-lg hover:bg-emerald-100" title="إضافة للسلة"><ShoppingCart className="w-4 h-4" /></button>
                    {hasPermission('estimates', 'print') && <button onClick={() => setPrintData({ type: 'ESTIMATE', data: est })} className="text-slate-400 hover:text-indigo-600 p-2 bg-slate-50 rounded-lg hover:bg-indigo-50" title="طباعة وعرض سريع"><Printer className="w-4 h-4" /></button>}
                    {hasPermission('estimates', 'edit') && <button onClick={() => { setEditingEstimate(est); setViewState('calculator'); window.scrollTo(0, 0); }} className="text-slate-400 hover:text-blue-600 p-2 bg-slate-50 rounded-lg hover:bg-blue-50" title="تعديل"><Edit className="w-4 h-4" /></button>}
                    {hasPermission('estimates', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا التقدير؟')) setEstimates(estimates.filter(e => e.id !== est.id)); }} className="text-slate-400 hover:text-red-500 p-2 bg-slate-50 rounded-lg hover:bg-red-50" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
                <div className="text-sm text-slate-500 mb-4 grid grid-cols-2 gap-y-2">
                  <div className="col-span-2">التصنيف: <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{estimateCategories.find(c => c.id === est.categoryId)?.name || 'غير مصنف'}</span></div>
                  <div>الشاصية: <span className="font-semibold text-slate-700">{est.chassis}</span></div>
                  <div>الأبعاد: <span className="font-semibold text-slate-700">{est.length}x{est.width}x{est.height}m</span></div>
                  <div>المرفقات: 
                    {est.attachments && est.attachments.length > 0 ? (
                      <span onClick={(e) => { e.stopPropagation(); setViewingAttachmentsFor(est); }} className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 rounded cursor-pointer hover:bg-blue-100 transition-colors mr-1">
                        <Paperclip className="w-3 h-3" />
                        <span className="font-bold text-xs">{est.attachments.length}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs mr-1">لا يوجد</span>
                    )}
                  </div>
                  {est.notes && <div className="col-span-2 bg-yellow-50 p-2 rounded text-yellow-800 text-xs mt-2 border border-yellow-200">ملاحظات: {est.notes}</div>}
                </div>
                <div className="bg-slate-50 p-3 rounded-lg mb-4 flex justify-between items-center border border-slate-100">
                  <div className="text-xs text-slate-500">سعر البيع المقترح</div>
                  <div className="font-bold text-blue-600 text-lg dir-ltr">{formatCurrency(est.sellPrice)}</div>
                </div>
                <button onClick={() => addToCart(est)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><ShoppingCart className="w-4 h-4" /> إضافة للسلة</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-4">المنتج / الوصف</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">الشاصية</th>
                    <th className="p-4 text-center">آخر تحديث</th>
                    <th className="p-4 text-center">الأبعاد (ط×ع×ا)</th>
                    <th className="p-4 text-center">المرفقات</th>
                    <th className="p-4 text-center">التكلفة</th>
                    <th className="p-4 text-center">الربح</th>
                    <th className="p-4 text-center">سعر البيع</th>
                    <th className="p-4 text-center w-32">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEstimates.map(est => (
                    <tr key={est.id} onDoubleClick={() => { if(!hasPermission('estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); setEditingEstimate(est); setViewState('calculator'); window.scrollTo(0, 0); }} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{est.desc}</div>
                        {est.notes && <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={est.notes}>{est.notes}</div>}
                      </td>
                      <td className="p-4"><span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">{estimateCategories.find(c => c.id === est.categoryId)?.name || 'غير مصنف'}</span></td>
                      <td className="p-4 font-semibold text-slate-700">{est.chassis}</td>
                      <td className="p-4 text-center text-xs text-slate-500 font-medium whitespace-nowrap">{parseDateSafely(est.lastUpdated || est.date || est.id).toLocaleString('ar-LY', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-4 text-center text-slate-600 dir-ltr">{est.length}x{est.width}x{est.height}</td>
                      <td className="p-4 text-center">
                        {est.attachments && est.attachments.length > 0 ? (
                          <button onClick={(e) => { e.stopPropagation(); setViewingAttachmentsFor(est); }} className="flex items-center justify-center gap-1 mx-auto text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors" title="عرض المرفقات">
                            <Paperclip className="w-4 h-4" />
                            <span className="font-bold text-xs">{est.attachments.length}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-semibold text-red-600 dir-ltr">{formatCurrency(est.totalCost)}</td>
                      <td className="p-4 text-center font-semibold text-emerald-600 dir-ltr">{formatCurrency(est.sellPrice - est.totalCost)}</td>
                      <td className="p-4 text-center font-bold text-blue-600 dir-ltr bg-blue-50/30">{formatCurrency(est.sellPrice)}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2" onDoubleClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); addToCart(est); }} className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-2 rounded" title="إضافة للسلة"><ShoppingCart className="w-4 h-4" /></button>
                          {hasPermission('estimates', 'print') && <button onClick={() => setPrintData({ type: 'ESTIMATE', data: est })} className="text-slate-400 bg-white border shadow-sm hover:text-indigo-600 p-2 rounded hover:bg-indigo-50" title="طباعة وعرض سريع"><Printer className="w-4 h-4" /></button>}
                          {hasPermission('estimates', 'edit') && <button onClick={() => { setEditingEstimate(est); setViewState('calculator'); window.scrollTo(0, 0); }} className="text-slate-400 bg-white border shadow-sm hover:text-blue-600 p-2 rounded hover:bg-blue-50" title="تعديل"><Edit className="w-4 h-4" /></button>}
                          {hasPermission('estimates', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا التقدير؟')) setEstimates(estimates.filter(e => e.id !== est.id)); }} className="text-slate-400 bg-white border shadow-sm hover:text-red-500 p-2 rounded hover:bg-red-50" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEstimates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">لا توجد تقديرات متاحة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 md:right-64 bg-white border-t border-slate-300 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] p-4 z-40">
            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-6">
              <div className="flex-1 flex gap-3 overflow-x-auto pb-2 scrollbar-hide w-full px-2">
                {cart.map(item => (
                  <div key={item.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 min-w-[220px] flex-shrink-0 relative shadow-sm">
                    <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="absolute top-2 left-2 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    <div className="font-bold text-sm text-blue-900 truncate pl-6 mb-1">{item.desc}</div>
                    <div className="text-xs text-slate-500 mb-2 truncate">شاصية: {item.chassis}</div>
                    <div className="flex items-center gap-2 mt-2 bg-white p-1 rounded border border-blue-100">
                      <span className="text-xs text-slate-500 px-1">الكمية:</span>
                      <input type="number" min="1" value={item.requestedQty} onChange={(e) => setCart(cart.map(c => c.id === item.id ? { ...c, requestedQty: Number(e.target.value) } : c))} className="w-full p-1 text-sm font-bold text-center outline-none bg-transparent" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center shrink-0 border-t lg:border-t-0 lg:border-r border-slate-200 pt-4 lg:pt-0 lg:pr-6">
                <button onClick={handleCreateWorkOrder} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex justify-center items-center gap-2"><Factory className="w-5 h-5" /> أوامر عمل للمصنع</button>
                <div className="w-full sm:w-px sm:h-10 bg-slate-200 hidden sm:block"></div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex gap-2">
                    <CustomerSelect value={proformaCustomer} onChange={setProformaCustomer} direction="up" />
                  </div>
                  <button onClick={handleCreateProforma} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md w-full">إصدار فاتورة مبدئية</button>
                </div>
              </div>
            </div>
          </div>
        )}

      {viewingAttachmentsFor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">مرفقات التقدير: {viewingAttachmentsFor.desc}</h2>
              <button onClick={() => setViewingAttachmentsFor(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {viewingAttachmentsFor.attachments?.map((att: any, idx: number) => (
                <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex flex-col">
                  {att.type?.startsWith('image/') ? (
                    <img src={att.data} alt={att.name || 'مرفق'} className="w-full h-auto object-contain max-h-[400px]" />
                  ) : (
                    <div className="p-8 flex flex-col items-center justify-center text-slate-500 text-center flex-1">
                      <FileText className="w-12 h-12 mb-2 text-slate-400" />
                      <div className="font-bold text-slate-700 mb-2">{att.name || 'مرفق غير مدعوم للعرض المباشر'}</div>
                      <a href={att.data} download={att.name || 'attachment'} className="text-blue-600 hover:underline text-sm border border-blue-200 px-3 py-1 rounded bg-blue-50">تحميل الملف</a>
                    </div>
                  )}
                  {att.type?.startsWith('image/') && (
                    <div className="p-2 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                      <span className="truncate flex-1 font-mono">{att.name}</span>
                      <a href={att.data} download={att.name || 'image'} className="text-blue-600 hover:underline px-2 border-r border-slate-200">تحميل</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      </div>
    );
  };
