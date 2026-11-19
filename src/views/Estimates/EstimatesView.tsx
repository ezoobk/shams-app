import React, { useState, useEffect, useRef } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useCustomers } from '../../context/CustomersContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Calculator, Plus, Trash2, Edit, Save, FileText, Check, Printer, X, Eye, EyeOff, LayoutDashboard, Database, Tags, ArrowUp, ArrowDown, Grid, List, Search, ShoppingCart, Factory, FilterX, Paperclip, ChevronRight, ChevronLeft, Download, RefreshCw } from 'lucide-react';
import { formatCurrency, numberToArabicWords, parseDateSafely } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';
import { logAudit } from '../../context/AuditLogContext';
import { getEstimateAttachments } from '../../api/client';

export const EstimatesView = ({ setViewState, setActiveTab, setTabStates, setEditingInvoice }: any) => {
    const { estimates, setEstimates, estimateCategories, cart, setCart, setEditingEstimate, setEditingContext } = useEstimates();
    const { generateId } = useSettings();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { customers } = useCustomers();
    const { hasPermission, currentUser } = useAuth();
    const { setPrintData } = usePrint();
    const [viewMode, setViewMode] = useLocalStorage('shams_estimates_view_mode', 'card');
    const [viewingAttachmentsFor, setViewingAttachmentsFor] = useState<any>(null);
    const [activeAttachmentIndex, setActiveAttachmentIndex] = useState<number>(0);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
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
      const handler = (e: KeyboardEvent) => {
        if (viewingAttachmentsFor) {
          const list = viewingAttachmentsFor.attachments || [];
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setViewingAttachmentsFor(null);
            setActiveAttachmentIndex(0);
          } else if (e.key === 'ArrowRight' && list.length > 1) {
            e.preventDefault();
            // In RTL or gallery: ArrowRight navigates to next or previous
            setActiveAttachmentIndex(prev => (prev < list.length - 1 ? prev + 1 : 0));
          } else if (e.key === 'ArrowLeft' && list.length > 1) {
            e.preventDefault();
            setActiveAttachmentIndex(prev => (prev > 0 ? prev - 1 : list.length - 1));
          }
          return;
        }

        if (e.key === 'Escape') {
          const currentTab = window.localStorage.getItem('shams_activeTab')?.replace(/"/g, '');
          if (currentTab !== 'estimates') return;
          if (cart.length > 0) setCart([]);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [cart, viewingAttachmentsFor]);

    const handleOpenAttachments = async (est: any) => {
      setActiveAttachmentIndex(0);
      setViewingAttachmentsFor(est);
      const atts = est.attachments || [];
      if (atts.length > 0 && atts.some((a: any) => a.hasData && !a.data)) {
        setIsLoadingAttachments(true);
        try {
          const res = await getEstimateAttachments(est.id);
          if (res.success && res.data) {
            const fullAtts = res.data;
            const updatedEst = { ...est, attachments: fullAtts };
            setViewingAttachmentsFor(updatedEst);
            setEstimates(prev => prev.map(item => item.id === est.id ? updatedEst : item));
          }
        } catch (err) {
          console.error('Failed to load full attachments:', err);
        } finally {
          setIsLoadingAttachments(false);
        }
      }
    };

    const handleEditEstimate = async (est: any) => {
      const atts = est.attachments || [];
      let targetEst = est;
      if (atts.length > 0 && atts.some((a: any) => a.hasData && !a.data)) {
        try {
          const res = await getEstimateAttachments(est.id);
          if (res.success && res.data) {
            targetEst = { ...est, attachments: res.data };
          }
        } catch (e) {
          console.error(e);
        }
      }
      setEditingEstimate(targetEst);
      setViewState('calculator');
      window.scrollTo(0, 0);
    };

    const getEstimateDate = (e: any) => {
      return parseDateSafely(e.date || e.lastUpdated || e.id);
    };

    const filteredEstimates = [...estimates]
      .filter(e =>
        !searchTerm || (
          (e.desc && e.desc.includes(searchTerm)) ||
          (e.chassis && e.chassis.includes(searchTerm)) ||
          (e.notes && e.notes.includes(searchTerm))
        )
      )
      .filter(e => filterCategory === '' || e.categoryId === filterCategory)
      .filter(e => filterDesc === '' || (e.desc && e.desc.includes(filterDesc)))
      .filter(e => filterLength === '' || Number(e.length) === Number(filterLength))
      .filter(e => filterWidth === '' || Number(e.width) === Number(filterWidth))
      .filter(e => filterHeight === '' || Number(e.height) === Number(filterHeight))
      .sort((a, b) => {
        if (sortBy === 'price') return (b.sellPrice || 0) - (a.sellPrice || 0);
        if (sortBy === 'price_asc') return (a.sellPrice || 0) - (b.sellPrice || 0);
        if (sortBy === 'date_asc') {
          return getEstimateDate(a).getTime() - getEstimateDate(b).getTime();
        }
        if (sortBy === 'updated') {
          const updA = parseDateSafely(a.lastUpdated || a.date || a.id).getTime();
          const updB = parseDateSafely(b.lastUpdated || b.date || b.id).getTime();
          return updB - updA;
        }
        return getEstimateDate(b).getTime() - getEstimateDate(a).getTime();
      });

    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 15;

    const totalPages = Math.ceil(filteredEstimates.length / rowsPerPage) || 1;

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, filterCategory, filterDesc, filterLength, filterWidth, filterHeight, sortBy]);

    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage]);

    const paginatedEstimates = filteredEstimates.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );

    const addToCart = (estimate) => {
      const existing = cart.find(c => c.id === estimate.id);
      if (existing) setCart(cart.map(c => c.id === estimate.id ? { ...c, requestedQty: c.requestedQty + 1 } : c));
      else setCart([...cart, { ...JSON.parse(JSON.stringify(estimate)), requestedQty: 1 }]);
    };

    const handleDeleteEstimate = (est: any) => {
      if (!hasPermission('estimates', 'delete')) return alert('ليس لديك صلاحية للحذف');
      if (window.confirm('هل أنت متأكد من حذف هذا التقدير؟')) {
        setEstimates(estimates.filter(e => e.id !== est.id));
        logAudit({
          actionType: 'delete',
          entityType: 'التقديرات',
          entityId: String(est.id),
          title: `حذف تقدير: ${est.desc || est.id}`,
          details: `سعر البيع: ${formatCurrency(est.sellPrice)} | الشاصية: ${est.chassis || '--'}`,
          targetCollection: 'estimates',
          previousState: est
        });
      }
    };

    const handleCreateWorkOrder = () => {
      if (!hasPermission('workOrders', 'create')) return alert('ليس لديك صلاحية لإنشاء أوامر تصنيع.');
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
      newWOs.forEach(wo => {
        logAudit({
          actionType: 'create',
          entityType: 'أوامر التصنيع',
          entityId: wo.id,
          title: `إنشاء أمر تصنيع: ${wo.id} من التقدير`,
          details: `المنتج: ${wo.items[0]?.desc} (${wo.items[0]?.serialNumber})`,
          targetCollection: 'work_orders',
          nextState: wo
        });
      });
      setCart([]);
      setActiveTab('workOrders');
    };

    const handleCreateProforma = () => {
      if (!hasPermission('invoices', 'create')) return alert('ليس لديك صلاحية لإصدار فواتير مبدئية.');
      if (cart.length === 0) return alert('السلة فارغة.');
      if (!proformaCustomer) return alert('الرجاء اختيار العميل.');

      const customer = customers.find(c => c.id === proformaCustomer);
      const subtotal = cart.reduce((sum, item) => sum + (item.sellPrice * item.requestedQty), 0);
      const newInvoice = {
        isDraft: true,
        type: 'مبدئية',
        customerName: customer?.name || proformaCustomer,
        items: cart.map(item => ({
          ...item,
          notes: ''
        })),
        total: subtotal,
        discount: 0,
        netTotal: subtotal,
        createdBy: currentUser ? {
          id: currentUser.id,
          name: currentUser.displayName,
          jobTitle: currentUser.jobTitle || 'مدير مبيعات',
          signature: currentUser.signature || '',
          stamp: currentUser.stamp || ''
        } : undefined
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
          <select className="border border-slate-200 rounded-lg p-2 bg-white shadow-sm outline-none w-full md:w-56 text-slate-700 font-medium shrink-0" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">ترتيب حسب: التاريخ (الأحدث)</option>
            <option value="date_asc">ترتيب حسب: التاريخ (الأقدم)</option>
            <option value="updated">ترتيب حسب: آخر تحديث</option>
            <option value="price">ترتيب حسب: السعر (الأعلى)</option>
            <option value="price_asc">ترتيب حسب: السعر (الأقل)</option>
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
          paginatedEstimates.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 mb-8 font-medium">
              لا توجد تقديرات متاحة.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedEstimates.map(est => (
                <div key={est.id} onDoubleClick={() => { if(!hasPermission('estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); handleEditEstimate(est); }} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{est.desc}</h3>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400">التاريخ:</span>
                        <span className="font-semibold text-slate-700">{getEstimateDate(est).toLocaleDateString('ar-LY', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                        {est.lastUpdated && est.date && est.lastUpdated !== est.date && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            (تحديث: {parseDateSafely(est.lastUpdated).toLocaleDateString('ar-LY')})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onDoubleClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); addToCart(est); }} className="text-emerald-600 hover:text-emerald-700 p-2 bg-emerald-50 rounded-lg hover:bg-emerald-100" title="إضافة للسلة"><ShoppingCart className="w-4 h-4" /></button>
                      {hasPermission('estimates', 'print') && <button onClick={(e) => { e.stopPropagation(); setPrintData({ type: 'ESTIMATE', data: est }); }} className="text-slate-400 hover:text-indigo-600 p-2 bg-slate-50 rounded-lg hover:bg-indigo-50" title="طباعة وعرض سريع"><Printer className="w-4 h-4" /></button>}
                      {hasPermission('estimates', 'edit') && <button onClick={() => handleEditEstimate(est)} className="text-slate-400 hover:text-blue-600 p-2 bg-slate-50 rounded-lg hover:bg-blue-50" title="تعديل"><Edit className="w-4 h-4" /></button>}
                      {hasPermission('estimates', 'delete') && <button onClick={() => handleDeleteEstimate(est)} className="text-slate-400 hover:text-red-500 p-2 bg-slate-50 rounded-lg hover:bg-red-50" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 mb-4 grid grid-cols-2 gap-y-2">
                    <div className="col-span-2">التصنيف: <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{estimateCategories.find(c => c.id === est.categoryId)?.name || 'غير مصنف'}</span></div>
                    <div>الشاصية: <span className="font-semibold text-slate-700">{est.chassis}</span></div>
                    <div>الأبعاد: <span className="font-semibold text-slate-700">{est.length}x{est.width}x{est.height}m</span></div>
                    <div>المرفقات: 
                      {est.attachments && est.attachments.length > 0 ? (
                        <span onClick={(e) => { e.stopPropagation(); handleOpenAttachments(est); }} className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 rounded cursor-pointer hover:bg-blue-100 transition-colors mr-1">
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
          )
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-4">المنتج / الوصف</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">الشاصية</th>
                    <th className="p-4 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => setSortBy(sortBy === 'date' ? 'date_asc' : 'date')} title="ترتيب حسب التاريخ">
                      <div className="inline-flex items-center gap-1 justify-center">
                        <span>التاريخ</span>
                        {sortBy === 'date' && <ArrowDown className="w-3.5 h-3.5 text-blue-600" />}
                        {sortBy === 'date_asc' && <ArrowUp className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </th>
                    <th className="p-4 text-center">الأبعاد (ط×ع×ا)</th>
                    <th className="p-4 text-center">المرفقات</th>
                    <th className="p-4 text-center">التكلفة</th>
                    <th className="p-4 text-center">الربح</th>
                    <th className="p-4 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => setSortBy(sortBy === 'price' ? 'price_asc' : 'price')} title="ترتيب حسب سعر البيع">
                      <div className="inline-flex items-center gap-1 justify-center">
                        <span>سعر البيع</span>
                        {sortBy === 'price' && <ArrowDown className="w-3.5 h-3.5 text-blue-600" />}
                        {sortBy === 'price_asc' && <ArrowUp className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </th>
                    <th className="p-4 text-center w-32">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEstimates.map(est => (
                    <tr key={est.id} onDoubleClick={() => { if(!hasPermission('estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); handleEditEstimate(est); }} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{est.desc}</div>
                        {est.notes && <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={est.notes}>{est.notes}</div>}
                      </td>
                      <td className="p-4"><span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">{estimateCategories.find(c => c.id === est.categoryId)?.name || 'غير مصنف'}</span></td>
                      <td className="p-4 font-semibold text-slate-700">{est.chassis}</td>
                      <td className="p-4 text-center text-xs text-slate-600 font-medium whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{getEstimateDate(est).toLocaleDateString('ar-LY', { year: 'numeric', month: 'numeric', day: 'numeric' })}</div>
                        {est.lastUpdated && est.date && est.lastUpdated !== est.date && (
                          <div className="text-[10px] text-slate-400 mt-0.5">تحديث: {parseDateSafely(est.lastUpdated).toLocaleDateString('ar-LY')}</div>
                        )}
                      </td>
                      <td className="p-4 text-center text-slate-600 dir-ltr">{est.length}x{est.width}x{est.height}</td>
                      <td className="p-4 text-center">
                        {est.attachments && est.attachments.length > 0 ? (
                          <button onClick={(e) => { e.stopPropagation(); handleOpenAttachments(est); }} className="flex items-center justify-center gap-1 mx-auto text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors" title="عرض المرفقات">
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
                          {hasPermission('estimates', 'print') && <button onClick={(e) => { e.stopPropagation(); setPrintData({ type: 'ESTIMATE', data: est }); }} className="text-slate-400 bg-white border shadow-sm hover:text-indigo-600 p-2 rounded hover:bg-indigo-50" title="طباعة وعرض سريع"><Printer className="w-4 h-4" /></button>}
                          {hasPermission('estimates', 'edit') && <button onClick={() => handleEditEstimate(est)} className="text-slate-400 bg-white border shadow-sm hover:text-blue-600 p-2 rounded hover:bg-blue-50" title="تعديل"><Edit className="w-4 h-4" /></button>}
                          {hasPermission('estimates', 'delete') && <button onClick={() => handleDeleteEstimate(est)} className="text-slate-400 bg-white border shadow-sm hover:text-red-500 p-2 rounded hover:bg-red-50" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedEstimates.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">لا توجد تقديرات متاحة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredEstimates.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 mb-8 shadow-sm">
            <span className="text-sm text-slate-500 font-medium">
              عرض {((currentPage - 1) * rowsPerPage) + 1} إلى {Math.min(currentPage * rowsPerPage, filteredEstimates.length)} من {filteredEstimates.length} تقدير
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => {
                    setCurrentPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} 
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </button>
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 1) return true;
                      return false;
                    })
                    .reduce((acc: (number | string)[], page, idx, arr) => {
                      if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) => {
                      if (item === '...') {
                        return <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-bold">...</span>;
                      }
                      const pageNum = item as number;
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`min-w-[34px] h-[34px] text-xs font-bold rounded-lg border transition-all ${
                            isActive
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                </div>
                <button 
                  onClick={() => {
                    setCurrentPage(p => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} 
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
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
                {hasPermission('workOrders', 'create') && (
                  <button onClick={handleCreateWorkOrder} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex justify-center items-center gap-2"><Factory className="w-5 h-5" /> أوامر عمل للمصنع</button>
                )}
                {hasPermission('workOrders', 'create') && hasPermission('invoices', 'create') && (
                  <div className="w-full sm:w-px sm:h-10 bg-slate-200 hidden sm:block"></div>
                )}
                {hasPermission('invoices', 'create') && (
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <div className="flex gap-2">
                      <CustomerSelect value={proformaCustomer} onChange={setProformaCustomer} direction="up" />
                    </div>
                    <button onClick={handleCreateProforma} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md w-full">إصدار فاتورة مبدئية</button>
                  </div>
                )}
                {!hasPermission('workOrders', 'create') && !hasPermission('invoices', 'create') && (
                  <div className="text-xs text-slate-500 font-bold p-2 bg-slate-100 rounded-lg">
                    صلاحياتك الحالية للعرض فقط ولا تتيح إصدار فواتير أو أوامر عمل.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {viewingAttachmentsFor && (() => {
        const list = viewingAttachmentsFor.attachments || [];
        const currentItem = list[activeAttachmentIndex] || list[0];
        const isImage = currentItem?.type?.startsWith('image/') || (currentItem?.data && currentItem.data.startsWith('data:image'));
        const total = list.length;

        const handlePrev = (e?: React.MouseEvent) => {
          if (e) e.stopPropagation();
          setActiveAttachmentIndex(prev => (prev > 0 ? prev - 1 : total - 1));
        };

        const handleNext = (e?: React.MouseEvent) => {
          if (e) e.stopPropagation();
          setActiveAttachmentIndex(prev => (prev < total - 1 ? prev + 1 : 0));
        };

        return (
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex flex-col justify-between p-3 md:p-6 select-none"
            onClick={() => { setViewingAttachmentsFor(null); setActiveAttachmentIndex(0); }}
          >
            {/* Top Bar */}
            <div 
              className="flex items-center justify-between bg-slate-900/70 border border-slate-700/50 rounded-xl px-4 py-3 text-white backdrop-blur-sm shadow-lg shrink-0 z-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <h2 className="text-base md:text-lg font-bold text-white truncate max-w-xs md:max-w-md">
                  مرفقات التقدير: <span className="text-blue-400">{viewingAttachmentsFor.desc}</span>
                </h2>
                {total > 1 && (
                  <span className="bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {activeAttachmentIndex + 1} / {total}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentItem && (
                  <a 
                    href={currentItem.data} 
                    download={currentItem.name || `attachment-${activeAttachmentIndex + 1}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                    title="تحميل الملف الحالي"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">تحميل</span>
                  </a>
                )}
                <button 
                  onClick={() => { setViewingAttachmentsFor(null); setActiveAttachmentIndex(0); }} 
                  className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                  title="إغلاق (Esc)"
                >
                  <X className="w-5 h-5" />
                  <span className="hidden sm:inline text-[11px] opacity-75">Esc</span>
                </button>
              </div>
            </div>

            {/* Main Stage (Single Image View) */}
            <div className="relative flex-1 flex items-center justify-center my-3 overflow-hidden min-h-0">
              {/* Prev Button */}
              {total > 1 && (
                <button
                  onClick={handlePrev}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white border border-slate-700/60 shadow-2xl backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                  title="السابق (السهم الأيمن)"
                >
                  <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}

              {/* Display Area */}
              <div 
                className="max-w-full max-h-full flex items-center justify-center p-2"
                onClick={e => e.stopPropagation()}
              >
                {isLoadingAttachments ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-300 gap-3">
                    <RefreshCw className="w-10 h-10 animate-spin text-blue-400" />
                    <span className="text-sm font-semibold">جاري تحميل المرفقات الأصلية...</span>
                  </div>
                ) : currentItem ? (
                  isImage ? (
                    <div className="relative group flex flex-col items-center justify-center">
                      <img 
                        src={currentItem.data} 
                        alt={currentItem.name || 'مرفق'} 
                        className="max-h-[72vh] max-w-[88vw] object-contain rounded-xl shadow-2xl border border-slate-700/40 bg-slate-900/40 transition-transform duration-200" 
                      />
                      {currentItem.name && (
                        <div className="mt-2 text-xs text-slate-300 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700/50 backdrop-blur-sm truncate max-w-sm">
                          {currentItem.name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-2xl max-w-md">
                      <div className="p-4 bg-blue-600/20 text-blue-400 rounded-2xl mb-4 border border-blue-500/30">
                        <FileText className="w-16 h-16" />
                      </div>
                      <h3 className="font-bold text-lg text-white mb-2">{currentItem.name || 'ملف مرفق غير مدعوم للعرض المباشر'}</h3>
                      <p className="text-slate-400 text-xs mb-6">هذا الملف ليس صورة مباشرة، يمكنك تحميله واستعراضه على جهازك.</p>
                      <a 
                        href={currentItem.data} 
                        download={currentItem.name || 'file'} 
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> تحميل الملف
                      </a>
                    </div>
                  )
                ) : (
                  <div className="text-slate-400 text-sm">لا يوجد مرفقات للعرض</div>
                )}
              </div>

              {/* Next Button */}
              {total > 1 && (
                <button
                  onClick={handleNext}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white border border-slate-700/60 shadow-2xl backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                  title="التالي (السهم الأيسر)"
                >
                  <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}
            </div>

            {/* Bottom Thumbnails Strip */}
            {total > 1 && (
              <div 
                className="flex items-center justify-center gap-2.5 overflow-x-auto py-2 px-4 bg-slate-900/70 border border-slate-700/50 rounded-xl backdrop-blur-sm shrink-0 z-10 max-w-2xl mx-auto scrollbar-thin"
                onClick={e => e.stopPropagation()}
              >
                {list.map((att: any, idx: number) => {
                  const isImg = att.type?.startsWith('image/') || (att.data && att.data.startsWith('data:image'));
                  const isActive = idx === activeAttachmentIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveAttachmentIndex(idx)}
                      className={`relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 transition-all flex items-center justify-center shrink-0 ${
                        isActive 
                          ? 'border-blue-400 ring-2 ring-blue-500/50 scale-105 bg-blue-900/30' 
                          : 'border-slate-700/80 opacity-60 hover:opacity-100 hover:border-slate-500 bg-slate-800'
                      }`}
                      title={att.name || `مرفق ${idx + 1}`}
                    >
                      {isImg ? (
                        <img src={att.data} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-6 h-6 text-slate-400" />
                      )}
                      <span className="absolute bottom-0 right-0 left-0 bg-black/60 text-[9px] text-white text-center font-bold">
                        {idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      </div>
    );
  };
