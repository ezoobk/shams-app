import React, { useState, useMemo, useEffect } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useInvoices } from '../../context/InvoicesContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { usePrint } from '../../context/PrintContext';
import { useLetters } from '../../context/LettersContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useDrivers } from '../../context/DriversContext';
import { FileText, Search, Archive, Truck, FileCheck2, FilterX, ChevronUp, ChevronDown, ChevronsUpDown, Download, Database, Mail, Grid, List, Printer, Trash2, FileEdit, X, Save } from 'lucide-react';
import { DriverSelect } from '../../components/ui/DriverSelect';
import { LettersView } from '../Letters/LettersView';
import { formatCurrency } from '../../utils/formatters';
import { ExportFilterModal } from '../../components/ui/ExportFilterModal';
import type { ExportFilters } from '../../components/ui/ExportFilterModal';


export const OutboundLogView = ({ setEditingInvoice, setActiveTab, setViewState }: any) => {
    const { invoices, setInvoices, deletedInvoices, setDeletedInvoices } = useInvoices();
    const { shippingOrders, setShippingOrders } = useShippingOrders();
    const { setPrintData } = usePrint();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { letters, setLetters } = useLetters();
    const { drivers } = useDrivers();
    const [editingShippingOrder, setEditingShippingOrder] = useState<any>(null);
    const [activeSubTab, setActiveSubTab] = useLocalStorage('shams_outbound_tab', 'general');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('الكل');
    const [exportModalTarget, setExportModalTarget] = useState<string | null>(null);
    const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useLocalStorage('outbound_viewMode', 'table'); // 'general' | 'invoices' | 'shipping'
    
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const [sortConfig, setSortConfig] = useLocalStorage('outbound_sortConfig', { key: 'date', direction: 'desc' });


    const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
      setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 inline text-slate-300 mx-1" />;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline text-blue-500 mx-1" /> : <ChevronDown className="w-3 h-3 inline text-blue-500 mx-1" />;
    };


    const deleteInvoice = (inv) => {
      if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟ (سيتم إرجاع المنتجات المباعة لحالتها السابقة في أوامر التصنيع وسيتم نقل الفاتورة إلى سجل المحذوفات)')) {
        if (inv.type === 'نهائية') {
          const sns = inv.items.map(i => i.serialNumber).filter(Boolean);
          setWorkOrders(prev => prev.map(wo => {
            let changed = false;
            const newWoItems = wo.items.map(wi => {
              if (sns.includes(wi.serialNumber)) { changed = true; return { ...wi, status: wi.mfgStatus || 'جاهز' }; }
              return wi;
            });
            return changed ? { ...wo, items: newWoItems } : wo;
          }));
        }
        setDeletedInvoices([{ ...inv, deletedAt: new Date().toISOString() }, ...deletedInvoices]);
        setInvoices(invoices.filter(i => i.id !== inv.id));
      }
    };

    const deleteShippingOrder = (so) => {
      if(window.confirm('هل أنت متأكد من حذف أمر النقل هذا من السجل؟ (سيتم إرجاع حالة المنتجات لـ "غير منقولة")')) {
        const sns = so.items.map(i => i.serialNumber).filter(Boolean);
        setWorkOrders(prev => prev.map(wo => {
          let changed = false;
          const newWoItems = wo.items.map(wi => {
            if (sns.includes(wi.serialNumber)) { changed = true; return { ...wi, shippingStatus: 'غير منقولة' }; }
            return wi;
          });
          return changed ? { ...wo, items: newWoItems } : wo;
        }));
        setShippingOrders(shippingOrders.filter(x => x.id !== so.id));
      }
    };

    const isDeletedView = filterType === 'محذوفة';
    const sourceArray = isDeletedView ? deletedInvoices : invoices;
    
    const filteredInvoices = useMemo(() => {
      let filtered = sourceArray.filter(inv => {
        const matchSearch = inv.id.toString().includes(searchTerm) || inv.customerName.includes(searchTerm);
        const matchType = filterType === 'الكل' || filterType === 'محذوفة' || inv.type === filterType;
        return matchSearch && matchType;
      });

      filtered.sort((a, b) => {
        let valA, valB;
        switch (sortConfig.key) {
          case 'id': valA = a.id; valB = b.id; break;
          case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
          case 'customerName': valA = a.customerName; valB = b.customerName; break;
          case 'type': valA = a.type; valB = b.type; break;
          case 'netTotal': valA = a.netTotal; valB = b.netTotal; break;
          default: valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    }, [sourceArray, searchTerm, filterType, sortConfig]);

    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const totalInvoicesPages = Math.ceil(filteredInvoices.length / rowsPerPage);

    const exportInvoicesToExcel = (filters: ExportFilters) => {
      let data = filteredInvoices;
      if (filters.dateFrom) data = data.filter(inv => new Date(inv.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(inv => new Date(inv.date) <= new Date(filters.dateTo + 'T23:59:59'));
      if (filters.refIdFrom) data = data.filter(inv => String(inv.id) >= String(filters.refIdFrom));
      if (filters.refIdTo) data = data.filter(inv => String(inv.id) <= String(filters.refIdTo));
      const headers = ['الرقم الإشاري', 'النوع', 'الزبون', 'التاريخ', 'المبلغ'];
      const rows = data.map(inv => [
        inv.id || '',
        inv.type || '',
        inv.customerName || '',
        inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : '',
        inv.netTotal || 0
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الفواتير");
      XLSX.writeFile(wb, `الفواتير_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    const filteredShipping = useMemo(() => {
      let filtered = shippingOrders.filter(so => 
        so.id.toString().includes(searchTerm) || so.destination.includes(searchTerm) || so.driver?.name?.includes(searchTerm)
      );

      filtered.sort((a, b) => {
        let valA, valB;
        switch (sortConfig.key) {
          case 'id': valA = a.id; valB = b.id; break;
          case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
          case 'destination': valA = a.destination; valB = b.destination; break;
          case 'driverName': valA = a.driver?.name; valB = b.driver?.name; break;
          case 'itemsCount': valA = a.items?.length || 0; valB = b.items?.length || 0; break;
          default: valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    }, [shippingOrders, searchTerm, sortConfig]);

    const paginatedShipping = filteredShipping.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const totalShippingPages = Math.ceil(filteredShipping.length / rowsPerPage);

    const exportShippingToExcel = (filters: ExportFilters) => {
      let data = filteredShipping;
      if (filters.dateFrom) data = data.filter(so => new Date(so.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(so => new Date(so.date) <= new Date(filters.dateTo + 'T23:59:59'));
      const headers = ['الرقم الإشاري', 'التاريخ', 'الوجهة', 'السائق والمركبة', 'عدد المنتجات'];
      const rows = data.map(so => [
        so.id || '',
        so.date ? new Date(so.date).toLocaleDateString('en-GB') : '',
        so.destination || '',
        `${so.driver?.name || ''} (${so.driver?.truckNumber || ''})`,
        so.items?.length || 0
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "أوامر النقل");
      XLSX.writeFile(wb, `أوامر_النقل_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    const allRecords = [
      ...invoices.map(inv => ({
        id: inv.id,
        date: inv.date,
        customerName: inv.customerName,
        subject: inv.type === 'مبدئية' ? 'فاتورة مبدئية' : 'فاتورة نهائية',
        original: inv,
        sourceType: 'invoice'
      })),
      ...shippingOrders.map(so => ({
        id: so.id,
        date: so.date,
        customerName: so.destination,
        subject: 'أمر نقل',
        original: so,
        sourceType: 'shipping'
      })),
      ...letters.map(ltr => ({
        id: ltr.id,
        date: ltr.date,
        customerName: ltr.to || ltr.customerName,
        subject: ltr.subject,
        original: ltr,
        sourceType: 'letter'
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredGeneral = useMemo(() => {
      let filtered = allRecords.filter(r => 
         r.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
         (r.customerName && r.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
         r.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );

      filtered.sort((a, b) => {
        let valA, valB;
        switch (sortConfig.key) {
          case 'id': valA = a.id; valB = b.id; break;
          case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
          case 'customerName': valA = a.customerName; valB = b.customerName; break;
          case 'subject': valA = a.subject; valB = b.subject; break;
          default: valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return filtered;
    }, [allRecords, searchTerm, sortConfig]);

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, sortConfig, activeSubTab]);

    const totalGeneralPages = Math.ceil(filteredGeneral.length / rowsPerPage);
    const paginatedGeneral = filteredGeneral.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const exportGeneralToExcel = (filters: ExportFilters) => {
      let data = filteredGeneral;
      if (filters.dateFrom) data = data.filter(r => new Date(r.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(r => new Date(r.date) <= new Date(filters.dateTo + 'T23:59:59'));
      if (filters.refIdFrom) data = data.filter(r => String(r.id) >= String(filters.refIdFrom));
      if (filters.refIdTo) data = data.filter(r => String(r.id) <= String(filters.refIdTo));
      const headers = ['الرقم الإشاري', 'التاريخ', 'العميل / الجهة', 'الموضوع'];
      const rows = data.map(record => [
        record.id || '',
        record.date ? new Date(record.date).toLocaleDateString('en-GB') : '',
        record.customerName || '',
        record.subject || ''
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "السجل العام");
      XLSX.writeFile(wb, `السجل_العام_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    return (
      <div className="w-full 2xl:max-w-[1800px] mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Archive className="w-6 h-6 text-slate-500" /> سجل الصادر (الفواتير والنقل)</h1>

        {/* Export Filter Modals */}
        <ExportFilterModal
          isOpen={exportModalTarget === 'general'}
          onClose={() => setExportModalTarget(null)}
          onExport={exportGeneralToExcel}
          title="تصدير السجل العام"
          showRefId={true}
        />
        <ExportFilterModal
          isOpen={exportModalTarget === 'invoices'}
          onClose={() => setExportModalTarget(null)}
          onExport={exportInvoicesToExcel}
          title="تصدير أرشيف الفواتير"
          showRefId={true}
        />
        <ExportFilterModal
          isOpen={exportModalTarget === 'shipping'}
          onClose={() => setExportModalTarget(null)}
          onExport={exportShippingToExcel}
          title="تصدير سجلات أوامر النقل"
        />

        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveSubTab('general')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 ${activeSubTab === 'general' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><Database className="w-5 h-5" /> السجل العام</button>
          <button onClick={() => setActiveSubTab('invoices')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 ${activeSubTab === 'invoices' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><FileText className="w-5 h-5" /> أرشيف الفواتير</button>
          <button onClick={() => setActiveSubTab('shipping')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 ${activeSubTab === 'shipping' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><Truck className="w-5 h-5" /> سجلات أوامر النقل</button>
          <button onClick={() => setActiveSubTab('letters')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 ${activeSubTab === 'letters' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><Mail className="w-5 h-5" /> الرسائل والمخاطبات</button>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm items-center">
          {activeSubTab !== 'letters' && <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات"><Grid className="w-4 h-4" /></button>
          </div>}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="بحث بالمرجع، العميل، السائق، الوجهة أو الموضوع..." className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {activeSubTab === 'invoices' && (
            <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-48 shrink-0" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="الكل">جميع الفواتير</option>
              <option value="مبدئية">مبدئية</option>
              <option value="نهائية">نهائية</option>
              <option value="محذوفة">سجل المحذوفات</option>
            </select>
          )}
          {(searchTerm || filterType !== 'الكل') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('الكل');
                setSortConfig({ key: 'date', direction: 'desc' });
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-bold transition-colors shrink-0"
              title="تفريغ التصفية والترتيب"
            >
              <FilterX className="w-4 h-4" /> تصفية البحث
            </button>
          )}
        </div>

        {activeSubTab === 'general' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>العميل / الجهة {getSortIcon('customerName')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('subject')}>الموضوع {getSortIcon('subject')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGeneral.map((record, idx) => (
                      <tr key={`general-${record.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-800">{record.id}</td>
                        <td className="p-4 text-center whitespace-nowrap">{new Date(record.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 font-bold">{record.customerName}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                             record.sourceType === 'invoice' ? 'bg-indigo-100 text-indigo-700' :
                             record.sourceType === 'shipping' ? 'bg-emerald-100 text-emerald-700' :
                             'bg-blue-100 text-blue-700'
                          }`}>{record.subject}</span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => {
                               if (record.sourceType === 'invoice') setPrintData({ type: 'INVOICE', data: record.original });
                               if (record.sourceType === 'shipping') setPrintData({ type: 'SHIPPING_ORDER', data: record.original });
                               if (record.sourceType === 'letter') setPrintData({ type: 'LETTER', data: record.original });
                            }} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>
                            <button onClick={() => {
                               if (record.sourceType === 'invoice') deleteInvoice(record.original);
                               if (record.sourceType === 'shipping') deleteShippingOrder(record.original);
                               if (record.sourceType === 'letter') {
                                 if (window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
                                   setLetters(letters.filter(l => l.id !== record.original.id));
                                 }
                               }
                            }} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedGeneral.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد سجلات مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedGeneral.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات.</div>
                ) : (
                  paginatedGeneral.map((record, idx) => (
                    <div key={`general-card-${record.id}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{record.id}</span>
                          <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(record.date).toLocaleDateString('ar-LY')}</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                           record.sourceType === 'invoice' ? 'bg-indigo-100 text-indigo-700' :
                           record.sourceType === 'shipping' ? 'bg-emerald-100 text-emerald-700' :
                           'bg-blue-100 text-blue-700'
                        }`}>{record.subject}</span>
                      </div>
                      <div className="flex-1 mb-4">
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">العميل / الجهة</div>
                        <div className="font-black text-slate-800">{record.customerName}</div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                        <button onClick={() => {
                           if (record.sourceType === 'invoice') setPrintData({ type: 'INVOICE', data: record.original });
                           if (record.sourceType === 'shipping') setPrintData({ type: 'SHIPPING_ORDER', data: record.original });
                           if (record.sourceType === 'letter') setPrintData({ type: 'LETTER', data: record.original });
                        }} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>
                        <button onClick={() => {
                           if (record.sourceType === 'invoice') deleteInvoice(record.original);
                           if (record.sourceType === 'shipping') deleteShippingOrder(record.original);
                           if (record.sourceType === 'letter') {
                             if (window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
                               setLetters(letters.filter(l => l.id !== record.original.id));
                             }
                           }
                        }} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded font-bold text-xs"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {filteredGeneral.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('general')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredGeneral.length)} من {filteredGeneral.length} سجل
                  </span>
                </div>
                {totalGeneralPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalGeneralPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalGeneralPages, p + 1))} 
                      disabled={currentPage === totalGeneralPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'invoices' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('type')}>النوع {getSortIcon('type')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>الزبون {getSortIcon('customerName')}</th>
                      <th className="p-4 text-center w-32 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('netTotal')}>المبلغ {getSortIcon('netTotal')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((inv, idx) => (
                      <tr key={`inv-${inv.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">{inv.id}</td>
                        <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold ${inv.type === 'نهائية' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{inv.type}</span></td>
                        <td className="p-4 font-semibold text-slate-800">{inv.customerName}</td>
                        <td className="p-4 text-center text-slate-500 whitespace-nowrap">{new Date(inv.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 text-center font-bold text-blue-600 dir-ltr">{formatCurrency(inv.netTotal)}</td>
                        <td className="p-4 text-center">
                          {filterType === 'محذوفة' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">حُذفت في: {inv.deletedAt ? new Date(inv.deletedAt).toLocaleDateString('ar-LY') : 'غير معروف'}</span>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-center">
                              {hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>}
                              <button onClick={() => { setEditingInvoice(inv); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1">تعديل / عرض التفاصيل</button>
                              <button onClick={() => deleteInvoice(inv)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginatedInvoices.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد فواتير مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedInvoices.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد فواتير مطابقة.</div>
                ) : (
                  paginatedInvoices.map(inv => {
                    const isDeleted = filterType === 'محذوفة';
                    return (
                      <div key={`inv-card-${inv.id}`} className={`bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md flex flex-col ${isDeleted ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{inv.id}</span>
                            <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(inv.date).toLocaleDateString('ar-LY')}</div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${inv.type === 'نهائية' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{inv.type}</span>
                        </div>
                        <div className="flex-1 mb-4">
                          <div className="text-xs uppercase font-bold text-slate-400 mb-1">العميل</div>
                          <div className="font-black text-slate-800 text-base">{inv.customerName}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg mb-4 text-center">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">الإجمالي</div>
                            <div className="font-bold text-emerald-600 text-sm" dir="ltr">{formatCurrency(inv.netTotal)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">المتبقي</div>
                            <div className="font-bold text-red-600 text-sm" dir="ltr">{formatCurrency(inv.remainingAmount)}</div>
                          </div>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                          <div className="flex gap-1">
                            {hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>}
                            {(!isDeleted && hasPermission('invoices', 'delete')) && <button onClick={() => deleteInvoice(inv)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded" title="إلغاء الفاتورة"><Trash2 className="w-4 h-4" /></button>}
                          </div>
                          {!isDeleted && (
                            <button onClick={() => { setEditingInvoice(inv); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1">
                              تعديل / عرض التفاصيل
                            </button>
                          )}
                          {isDeleted && inv.deletedAt && (
                            <div className="text-xs text-red-500 font-bold self-center">حُذفت في: {new Date(inv.deletedAt).toLocaleDateString('ar-LY')}</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            
            {filteredInvoices.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('invoices')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredInvoices.length)} من {filteredInvoices.length} فاتورة
                  </span>
                </div>
                {totalInvoicesPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalInvoicesPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalInvoicesPages, p + 1))} 
                      disabled={currentPage === totalInvoicesPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'shipping' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>رقم أمر النقل {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('driverName')}>السائق / الناقل {getSortIcon('driverName')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('destination')}>الوجهة {getSortIcon('destination')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedShipping.map((so, idx) => (
                      <tr key={`so-${so.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">{so.id}</td>
                        <td className="p-4 text-center text-slate-500 whitespace-nowrap">{new Date(so.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 font-semibold text-slate-800">{so.driver?.name || so.driverName || '--'}</td>
                        <td className="p-4 text-slate-600">{so.destination}</td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            {hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: so })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>}
                            {hasPermission('invoices', 'edit') && <button onClick={() => setEditingShippingOrder(so)} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded" title="تعديل"><FileEdit className="w-4 h-4" /></button>}
                            <button onClick={() => deleteShippingOrder(so)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedShipping.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد سجلات نقل مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedShipping.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات نقل.</div>
                ) : (
                  paginatedShipping.map(so => (
                    <div key={`so-card-${so.id}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{so.id}</span>
                          <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(so.date).toLocaleDateString('ar-LY')}</div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">أمر نقل</span>
                      </div>
                      <div className="flex-1 mb-4">
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">الناقل / السائق</div>
                        <div className="font-black text-slate-800 text-base mb-3">{so.driver?.name || so.driverName || '--'}</div>
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">الوجهة</div>
                        <div className="font-bold text-slate-700 text-sm">{so.destination}</div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                        {hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: so })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>}
                        {hasPermission('invoices', 'edit') && <button onClick={() => setEditingShippingOrder(so)} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><FileEdit className="w-4 h-4" /> تعديل</button>}
                        <button onClick={() => deleteShippingOrder(so)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded font-bold text-xs"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {filteredShipping.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('shipping')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredShipping.length)} من {filteredShipping.length} أمر نقل
                  </span>
                </div>
                {totalShippingPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalShippingPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalShippingPages, p + 1))} 
                      disabled={currentPage === totalShippingPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'letters' && (
          <LettersView searchTerm={searchTerm} />
        )}

        {editingShippingOrder && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800">تعديل أمر النقل {editingShippingOrder.id}</h2>
                <button onClick={() => setEditingShippingOrder(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6 text-right overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">الناقل / السائق</label>
                    <DriverSelect 
                      value={editingShippingOrder.driver?.id || editingShippingOrder.driverId} 
                      onChange={(id) => {
                         const driver = drivers.find(d => d.id === id);
                         setEditingShippingOrder({...editingShippingOrder, driver, driverName: driver?.name});
                      }} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">الوجهة</label>
                    <input type="text" value={editingShippingOrder.destination || ''} onChange={e => setEditingShippingOrder({...editingShippingOrder, destination: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">محتويات المنتجات المرفقة</h3>
                  <div className="space-y-3">
                    {editingShippingOrder.items?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-700">{item.desc || item.name}</span>
                          <span className="text-xs font-mono bg-white px-2 py-1 border border-slate-200 rounded text-slate-500">SN: {item.serialNumber}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="محتويات المنتج (اختياري)..."
                          value={item.contents || ''}
                          onChange={(e) => {
                            const newItems = [...(editingShippingOrder.items || [])];
                            newItems[idx] = { ...item, contents: e.target.value };
                            setEditingShippingOrder({ ...editingShippingOrder, items: newItems });
                          }}
                          className="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end shrink-0">
                <button onClick={() => setEditingShippingOrder(null)} className="px-5 py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">إلغاء</button>
                <button onClick={() => {
                  setShippingOrders(shippingOrders.map(so => so.id === editingShippingOrder.id ? editingShippingOrder : so));
                  setEditingShippingOrder(null);
                }} className="px-5 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center gap-2"><Save className="w-4 h-4" /> حفظ التعديلات</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

