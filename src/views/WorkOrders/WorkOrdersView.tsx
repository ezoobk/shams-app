import React, { useState, useEffect, useMemo } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useCustomers } from '../../context/CustomersContext';
import { useDrivers } from '../../context/DriversContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { useInvoices } from '../../context/InvoicesContext';
import { Factory, Search, FileText, Settings, Play, Check, Package, Calendar, Clock, AlertTriangle, Truck, Tag, Plus, Edit, Hash, Printer, MoveUp, MoveDown, ChevronsUpDown, ChevronUp, ChevronDown, Database, FilterX, X, Trash2, Download, FileCheck2, MapPin, Save, Grid, List } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';
import { DriverSelect } from '../../components/ui/DriverSelect';
import * as XLSX from 'xlsx';
import { ExportFilterModal } from '../../components/ui/ExportFilterModal';
import type { ExportFilters } from '../../components/ui/ExportFilterModal';


export const WorkOrdersView = ({ setViewState, setEditingInvoice, setActiveTab, setTabStates }: any) => {
    const { invoices, setInvoices, deletedInvoices } = useInvoices();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { generateId } = useSettings();
    const { drivers } = useDrivers();
    const { shippingOrders, setShippingOrders } = useShippingOrders();
    const { setPrintData } = usePrint();
    const { customers } = useCustomers();
    const { setEditingEstimate, setEditingContext } = useEstimates();
    const [selectedItemsForInvoice, setSelectedItemsForInvoice] = useLocalStorage('wo_selectedItems', []);
    const [finalCustomer, setFinalCustomer] = useLocalStorage('wo_finalCustomer', '');
    const [showShippingModal, setShowShippingModal] = useState(false);
    const [searchTerm, setSearchTerm] = useLocalStorage('wo_searchTerm', '');
    const [filterMfgStatus, setFilterMfgStatus] = useLocalStorage('wo_filterMfg', 'الكل');
    const [filterSaleStatus, setFilterSaleStatus] = useLocalStorage('wo_filterSale', 'الكل');
    const [filterShipping, setFilterShipping] = useLocalStorage('wo_filterShipping', 'الكل');
    const [filterDesc, setFilterDesc] = useLocalStorage('wo_filterDesc', '');

    const getItemStatus = (item) => {
      const inv = invoices.find(inv => inv.type === 'نهائية' && inv.items && inv.items.some(x => x.serialNumber === item.serialNumber));
      const so = shippingOrders.find(so => so.items && so.items.some(x => x.serialNumber === item.serialNumber));
      const mfgStatus = item.mfgStatus || (item.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع');
      const saleStatus = inv || item.status === 'مباع' ? 'مباع' : 'غير مباعة';
      const shippingStatus = item.shippingStatus || (so ? 'منقولة' : 'غير منقولة');
      return { inv, so, mfgStatus, saleStatus, shippingStatus };
    };
    const [filterLength, setFilterLength] = useLocalStorage('wo_filterLen', '');
    const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useLocalStorage('wo_viewMode', 'table');
    const [filterWidth, setFilterWidth] = useLocalStorage('wo_filterWid', '');
    const [filterHeight, setFilterHeight] = useLocalStorage('wo_filterHei', '');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    
    const [driverId, setDriverId] = useState('');
    const [destination, setDestination] = useState('');
    const [shippingContents, setShippingContents] = useState({});

    const [showLegacyImportModal, setShowLegacyImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [legacyItems, setLegacyItems] = useState([{ id: Date.now(), serialNumber: '', desc: '', chassis: '', length: '', width: '', height: '', sellPrice: '', mfgStatus: 'جاهز', isSold: false, customerName: '' }]);

    useEffect(() => {
      const handler = e => {
        if (e.key === 'Escape') {
          const currentTab = window.localStorage.getItem('shams_activeTab')?.replace(/"/g, '');
          if (currentTab !== 'workOrders') return;
          
          if (showShippingModal) setShowShippingModal(false);
          else if (showLegacyImportModal) setShowLegacyImportModal(false);
          else if (selectedItemsForInvoice.length > 0) setSelectedItemsForInvoice([]);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [showShippingModal, showLegacyImportModal, selectedItemsForInvoice]);

    const handleSaveLegacyItems = () => {
      const validItems = legacyItems.filter(i => i.serialNumber && i.desc);
      if (validItems.length === 0) return alert('الرجاء إدخال رقم تصنيع ووصف لمنتج واحد على الأقل.');

      const hasInvalidSold = validItems.some(i => i.isSold && !i.customerName);
      if (hasInvalidSold) return alert('يجب تحديد اسم الزبون للمنتجات المباعة.');

      const newWoItems = validItems.map(i => ({
        serialNumber: i.serialNumber,
        desc: i.desc,
        chassis: i.chassis || '-',
        length: i.length || 0,
        width: i.width || 0,
        height: i.height || 0,
        sellPrice: Number(i.sellPrice) || 0,
        status: i.isSold ? 'مباع' : i.mfgStatus,
        mfgStatus: i.mfgStatus,
        shippingStatus: 'غير منقولة',
        notes: 'رصيد افتتاحي'
      }));

      const newWo = {
        id: generateId('wo'),
        date: new Date().toISOString(),
        items: newWoItems,
        notes: 'أرصدة افتتاحية - جرد'
      };

      setWorkOrders(prev => [newWo, ...prev]);

      const soldItems = validItems.filter(i => i.isSold);
      const customers = [...new Set(soldItems.map(i => i.customerName))];
      
      const newInvoices = customers.map(cust => {
        const custItems = soldItems.filter(i => i.customerName === cust);
        return {
          id: generateId('invF', cust),
          date: new Date().toISOString(),
          type: 'نهائية',
          customerName: cust,
          items: custItems.map(i => ({
            serialNumber: i.serialNumber,
            desc: i.desc,
            chassis: i.chassis,
            sellPrice: Number(i.sellPrice) || 0
          })),
          payments: [],
          notes: 'رصيد افتتاحي مدخل يدوياً'
        };
      });

      if (newInvoices.length > 0) {
        setInvoices(prev => [...newInvoices, ...prev]);
      }

      alert('تم إدخال الأرصدة الافتتاحية بنجاح!');
      setShowLegacyImportModal(false);
      setLegacyItems([{ id: Date.now(), serialNumber: '', desc: '', chassis: '', length: '', width: '', height: '', sellPrice: '', mfgStatus: 'جاهز', isSold: false, customerName: '' }]);
    };

    const generateShippingOrder = () => {
      if (!driverId) return alert('الرجاء اختيار السائق');
      if (!destination) return alert('الرجاء كتابة الوجهة');
      const driver = drivers.find(d => d.id === driverId);
      const itemsToShip = workOrders.flatMap(wo => wo.items).filter(item => selectedItemsForInvoice.includes(item.serialNumber));
      
      const invoiceForItems = invoices.find(inv => inv.items && inv.items.some(i => itemsToShip.some(shi => shi.serialNumber === i.serialNumber)));
      const customerName = invoiceForItems ? invoiceForItems.customerName : 'عميل غير محدد';
      
      const newOrder = {
        id: generateId('shp', customerName),
        date: new Date().toISOString(),
        driver,
        destination,
        customerName,
        items: itemsToShip.map(item => ({ ...item, contents: shippingContents[item.serialNumber] || '' }))
      };
      
      setWorkOrders(workOrders.map(wo => ({
        ...wo,
        items: wo.items.map(item => selectedItemsForInvoice.includes(item.serialNumber) ? { ...item, shippingStatus: 'منقولة' } : item)
      })));
      
      setShippingOrders([newOrder, ...shippingOrders]);
      
      setPrintData({ type: 'SHIPPING_ORDER', data: newOrder });
      setShowShippingModal(false);
      setSelectedItemsForInvoice([]);
    };

    const uniqueDescriptions = Array.from(new Set(workOrders.flatMap(wo => wo.items.map(i => i.desc)).filter(Boolean)));

    const toggleStatus = (woId, serialNumber) => {
      setWorkOrders(workOrders.map(wo => wo.id === woId ? { ...wo, items: wo.items.map(item => {
        if (item.serialNumber === serialNumber) {
          const { mfgStatus } = getItemStatus(item);
          return { ...item, mfgStatus: mfgStatus === 'قيد التصنيع' ? 'جاهز' : 'قيد التصنيع' };
        }
        return item;
      }) } : wo));
      setSelectedItemsForInvoice(prev => prev.filter(sn => sn !== serialNumber));
    };

    const handleSelectForInvoice = (serialNumber) => setSelectedItemsForInvoice(prev => prev.includes(serialNumber) ? prev.filter(sn => sn !== serialNumber) : [...prev, serialNumber]);

    const createFinalInvoice = () => {
      if (selectedItemsForInvoice.length === 0) return alert('الرجاء تحديد منتجات.');
      const selectedItems = workOrders.flatMap(wo => wo.items).filter(item => selectedItemsForInvoice.includes(item.serialNumber));
      if (selectedItems.some(i => getItemStatus(i).saleStatus === 'مباع')) return alert('لا يمكن إصدار فاتورة لمنتجات مباعة مسبقاً.');
      if (!finalCustomer) return alert('الرجاء اختيار العميل.');
      let itemsToInvoice = [];
      workOrders.forEach(wo => {
        wo.items.forEach(item => {
          if (selectedItemsForInvoice.includes(item.serialNumber)) {
            itemsToInvoice.push({ ...item, requestedQty: 1 });
          }
        });
      });
      const customer = customers.find(c => c.id === finalCustomer);
      const subtotal = itemsToInvoice.reduce((sum, item) => sum + item.sellPrice, 0);
      const newInvoice = {
        isDraft: true,
        type: 'نهائية',
        customerName: customer?.name || finalCustomer,
        items: itemsToInvoice,
        total: subtotal,
        discount: 0,
        netTotal: subtotal
      };
      setEditingInvoice(newInvoice);
      setSelectedItemsForInvoice([]);
      setFinalCustomer('');
      setActiveTab('invoices');
      setTabStates(prev => ({ ...prev, invoices: 'edit_invoice' }));
    };

    const filteredWOs = workOrders.map(wo => {
      const matchesWoId = wo.id.toLowerCase().includes(searchTerm.toLowerCase());
      const woDateStr = wo.date ? new Date(wo.date).toLocaleDateString('en-GB') : '';
      const matchesWoDate = woDateStr.includes(searchTerm) || (wo.date && wo.date.includes(searchTerm));
      
      return {
        ...wo,
        items: wo.items.map(i => {
          const stats = getItemStatus(i);
          return { ...i, _inv: stats.inv, _so: stats.so, _mfgStatus: stats.mfgStatus, _saleStatus: stats.saleStatus, _shippingStatus: stats.shippingStatus };
        }).filter(i => {
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = 
            (i.desc && i.desc.toLowerCase().includes(searchLower)) || 
            (i.chassis && i.chassis.toLowerCase().includes(searchLower)) || 
            (i.serialNumber && i.serialNumber.toLowerCase().includes(searchLower)) ||
            matchesWoId ||
            matchesWoDate ||
            (i._inv && ((i._inv.id && i._inv.id.toLowerCase().includes(searchLower)) || (i._inv.customerName && i._inv.customerName.toLowerCase().includes(searchLower)))) ||
            (i._so && i._so.id && i._so.id.toLowerCase().includes(searchLower));

          const matchesMfgStatus = filterMfgStatus === 'الكل' || i._mfgStatus === filterMfgStatus;
          const matchesSaleStatus = filterSaleStatus === 'الكل' || i._saleStatus === filterSaleStatus;
          const matchesShipping = filterShipping === 'الكل' || i._shippingStatus === filterShipping;

          const matchesDesc = filterDesc === '' || (i.desc && i.desc.includes(filterDesc));
          const matchesLength = filterLength === '' || Number(i.length) === Number(filterLength);
          const matchesWidth = filterWidth === '' || Number(i.width) === Number(filterWidth);
          const matchesHeight = filterHeight === '' || Number(i.height) === Number(filterHeight);
          return matchesSearch && matchesMfgStatus && matchesSaleStatus && matchesShipping && matchesDesc && matchesLength && matchesWidth && matchesHeight;
        })
      };
    }).filter(wo => wo.items.length > 0);

    const [sortConfig, setSortConfig] = useLocalStorage('wo_sortConfig', { key: 'sn', direction: 'desc' });

    const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
      setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 inline text-slate-300 mx-1" />;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline text-blue-500 mx-1" /> : <ChevronDown className="w-3 h-3 inline text-blue-500 mx-1" />;
    };

    const sortedFlattenedItems = useMemo(() => {
      let items = [];
      filteredWOs.forEach(wo => {
        wo.items.forEach(item => {
          items.push({ ...item, _woId: wo.id, _woDate: wo.date, _wo: wo });
        });
      });

      items.sort((a, b) => {
        let valA, valB;
        switch (sortConfig.key) {
          case 'woId': valA = a._woId; valB = b._woId; break;
          case 'desc': valA = a.desc; valB = b.desc; break;
          case 'sn': valA = a.serialNumber; valB = b.serialNumber; break;
          case 'price': valA = Number(a.sellPrice) || 0; valB = Number(b.sellPrice) || 0; break;
          case 'mfgStatus': valA = a._mfgStatus; valB = b._mfgStatus; break;
          case 'saleStatus': valA = a._saleStatus; valB = b._saleStatus; break;
          case 'shippingStatus': valA = a._shippingStatus; valB = b._shippingStatus; break;
          default: valA = a.serialNumber; valB = b.serialNumber;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return items;
    }, [filteredWOs, sortConfig]);

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, filterMfgStatus, filterSaleStatus, filterShipping, filterDesc, filterLength, filterWidth, filterHeight, sortConfig]);

    const totalPages = Math.ceil(sortedFlattenedItems.length / rowsPerPage);
    const paginatedItems = sortedFlattenedItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const selectedItemsFull = selectedItemsForInvoice.map(sn => {
      let rawItem = null;
      workOrders.some(wo => {
        const found = wo.items.find(i => i.serialNumber === sn);
        if (found) { rawItem = found; return true; }
        return false;
      });
      if (!rawItem) return null;
      return { ...rawItem, ...getItemStatus(rawItem) };
    }).filter(Boolean);

    const allUnsold = selectedItemsFull.length > 0 && selectedItemsFull.every(i => i.saleStatus === 'غير مباعة');
    const allSold = selectedItemsFull.length > 0 && selectedItemsFull.every(i => i.saleStatus === 'مباع');
    const mixedSaleStatus = selectedItemsFull.length > 0 && !allUnsold && !allSold;

    const exportToExcel = (filters: ExportFilters) => {
      let data = sortedFlattenedItems;
      if (filters.dateFrom) data = data.filter(item => new Date(item._woDate) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(item => new Date(item._woDate) <= new Date(filters.dateTo + 'T23:59:59'));
      if (filters.workOrderId) data = data.filter(item => item._woId && item._woId.toLowerCase().includes(filters.workOrderId!.toLowerCase()));
      
      const headers = [
        'رقم أمر العمل', 'تاريخ أمر العمل', 'رقم التصنيع (SN)', 'المنتج / المواصفات',
        'الشاصية', 'الأبعاد (ط x ع x ا)', 'ملاحظات', 'السعر', 'حالة التصنيع',
        'حالة البيع', 'رقم الفاتورة', 'اسم الزبون', 'حالة النقل', 'رقم أمر النقل'
      ];
      
      const rows = data.map(item => [
        item._woId || '',
        item._woDate ? new Date(item._woDate).toLocaleDateString('en-GB') : '',
        item.serialNumber || '',
        item.desc || '',
        item.chassis || '',
        `${item.length || 0}x${item.width || 0}x${item.height || 0}`,
        item.notes || '',
        Number(item.sellPrice) || 0,
        item._mfgStatus || '',
        item._saleStatus || '',
        item._inv ? item._inv.id : '',
        item._inv ? item._inv.customerName : '',
        item._shippingStatus || '',
        item._so ? item._so.id : ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Set right-to-left
      ws['!dir'] = 'rtl';
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "أوامر التصنيع");
      XLSX.writeFile(wb, `أوامر_العمل_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    return (
      <div className="relative pb-40">
        <ExportFilterModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={exportToExcel}
          title="تصدير أوامر التصنيع"
          showWorkOrderId={true}
        />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">أوامر التصنيع النشطة</h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول">
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات">
                <Grid className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowLegacyImportModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 text-sm flex items-center gap-2"><Database className="w-4 h-4" /> إدخال أرصدة سابقة (جرد)</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="بحث برقم التسلسل، الشاصية، الفاتورة، العميل، أمر العمل، النقل، أو التاريخ..." className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-40 shrink-0" value={filterMfgStatus} onChange={e => setFilterMfgStatus(e.target.value)}>
            <option value="الكل">حالة التصنيع (الكل)</option>
            <option value="قيد التصنيع">قيد التصنيع</option>
            <option value="جاهز">جاهز</option>
          </select>
          <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-40 shrink-0" value={filterSaleStatus} onChange={e => setFilterSaleStatus(e.target.value)}>
            <option value="الكل">حالة البيع (الكل)</option>
            <option value="مباع">مباع / مفوتر</option>
            <option value="غير مباعة">غير مباعة</option>
          </select>
          <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-40 shrink-0" value={filterShipping} onChange={e => setFilterShipping(e.target.value)}>
            <option value="الكل">حالة النقل (الكل)</option>
            <option value="منقولة">منقولة</option>
            <option value="غير منقولة">غير منقولة</option>
          </select>
          {(searchTerm || filterMfgStatus !== 'الكل' || filterSaleStatus !== 'الكل' || filterShipping !== 'الكل' || filterDesc || filterLength || filterWidth || filterHeight) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterMfgStatus('الكل');
                setFilterSaleStatus('الكل');
                setFilterShipping('الكل');
                setFilterDesc('');
                setFilterLength('');
                setFilterWidth('');
                setFilterHeight('');
                setSortConfig({ key: 'woId', direction: 'desc' });
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-bold transition-colors shrink-0"
              title="تفريغ التصفية والترتيب"
            >
              <FilterX className="w-4 h-4" /> تصفية البحث
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-bold text-slate-700">تصفية سريعة:</span>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">المنتج:</label>
            <input type="text" list="desc-filters-wo" placeholder="اختر للتصفية..." className="w-32 outline-none bg-transparent font-bold text-slate-800 text-sm" value={filterDesc} onChange={e => setFilterDesc(e.target.value)} />
            <datalist id="desc-filters-wo">
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
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-slate-500 border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="p-4 w-12 text-center">تحديد</th>
                  <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('woId')}>رقم أمر العمل {getSortIcon('woId')}</th>
                  <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('desc')}>المنتج / المواصفات {getSortIcon('desc')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('sn')}>رقم التصنيع (SN) {getSortIcon('sn')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('price')}>السعر {getSortIcon('price')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('mfgStatus')}>حالة التصنيع {getSortIcon('mfgStatus')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('saleStatus')}>حالة البيع {getSortIcon('saleStatus')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('shippingStatus')}>حالة النقل {getSortIcon('shippingStatus')}</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">لا توجد أوامر عمل تطابق البحث.</td>
                  </tr>
                ) : (
                  paginatedItems.map((item, idx) => {
                    const isSameWoAsPrev = idx > 0 && paginatedItems[idx - 1]._woId === item._woId && sortConfig.key === 'woId';
                    return (
                      <tr key={item.serialNumber} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedItemsForInvoice.includes(item.serialNumber) ? 'bg-indigo-50/50' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" className="w-4 h-4 cursor-pointer" disabled={(item._saleStatus === 'مباع' && (item._mfgStatus !== 'جاهز' || item._shippingStatus === 'منقولة')) || item._shippingStatus === 'منقولة'} checked={selectedItemsForInvoice.includes(item.serialNumber)} onChange={() => handleSelectForInvoice(item.serialNumber)} />
                        </td>
                        <td className="p-4">
                          {!isSameWoAsPrev ? (
                            <div className="flex flex-col gap-2">
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block whitespace-nowrap">{item._woId}</span>
                              {item._woDate && <span className="text-xs text-slate-500 font-mono">{new Date(item._woDate).toLocaleDateString('en-GB')}</span>}
                              <div className="flex gap-1">
                                {hasPermission('workOrders', 'print') && <button onClick={() => setPrintData({ type: 'WORK_ORDER', data: item._wo })} className="bg-slate-100 text-slate-600 p-1 rounded hover:bg-slate-200" title="طباعة للتصنيع"><Printer className="w-3.5 h-3.5" /></button>}
                                {hasPermission('workOrders', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟')) setWorkOrders(workOrders.filter(w => w.id !== item._woId)); }} className="bg-red-50 text-red-500 p-1 rounded hover:bg-red-100" title="إلغاء الأمر"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-slate-300 px-2 py-1 inline-block">↑</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800">{item.desc}</div>
                          <div className="text-xs text-slate-500 mt-1">شاصية: {item.chassis} | {item.length}x{item.width}x{item.height}</div>
                          {item.notes && <div className="text-xs text-slate-500 mt-1">ملاحظة: {item.notes}</div>}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-blue-600 bg-blue-50/30">{item.serialNumber}</td>
                        <td className="p-4 text-center font-semibold text-slate-700 dir-ltr">{formatCurrency(item.sellPrice)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${item._mfgStatus === 'جاهز' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item._mfgStatus}</span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item._saleStatus === 'مباع' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{item._saleStatus}</span>
                            {item._inv && (
                              <div className="flex flex-col gap-0.5 items-center bg-slate-50 p-1 rounded border border-slate-100 w-full mt-1">
                                <span className="text-[10px] text-slate-500 font-mono" title="رقم الفاتورة">{item._inv.id}</span>
                                <span className="text-[10px] text-slate-700 font-bold truncate w-24 text-center" title={item._inv.customerName}>{item._inv.customerName}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item._shippingStatus === 'منقولة' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{item._shippingStatus}</span>
                            {item._so && (
                              <div className="mt-1 bg-slate-50 p-1 rounded border border-slate-100 w-full">
                                <span className="text-[10px] text-slate-500 font-mono" title="رقم أمر النقل">{item._so.id}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => toggleStatus(item._woId, item.serialNumber)} className="text-sm px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100">تغيير الحالة</button>
                            <button onClick={() => { setEditingEstimate(item); setEditingContext({ type: 'workOrder', woId: item._woId }); setViewState('calculator'); window.scrollTo(0,0); }} className="text-sm px-3 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">المواد والتفاصيل</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {paginatedItems.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد أوامر عمل تطابق البحث.</div>
            ) : (
              paginatedItems.map((item, idx) => (
                <div key={item.serialNumber} className={`relative flex flex-col bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md ${selectedItemsForInvoice.includes(item.serialNumber) ? 'border-indigo-400 ring-2 ring-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`}>
                  <div className="absolute top-4 left-4 z-10 bg-white rounded-full">
                    <input type="checkbox" className="w-5 h-5 cursor-pointer accent-indigo-600" disabled={(item._saleStatus === 'مباع' && (item._mfgStatus !== 'جاهز' || item._shippingStatus === 'منقولة')) || item._shippingStatus === 'منقولة'} checked={selectedItemsForInvoice.includes(item.serialNumber)} onChange={() => handleSelectForInvoice(item.serialNumber)} />
                  </div>
                  
                  <div className="mb-3 pr-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{item._woId}</span>
                      {item._woDate && <span className="text-xs text-slate-500 font-mono">{new Date(item._woDate).toLocaleDateString('en-GB')}</span>}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight pl-6">{item.desc}</h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${item._mfgStatus === 'جاهز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{item._mfgStatus}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${item._saleStatus === 'مباع' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{item._saleStatus}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${item._shippingStatus === 'منقولة' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{item._shippingStatus}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mb-4 flex-1">
                    <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">رقم التصنيع (SN)</span><span className="font-mono font-bold text-slate-700 text-sm">{item.serialNumber}</span></div>
                    <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">السعر</span><span className="font-black text-emerald-600 text-sm" dir="ltr">{formatCurrency(item.sellPrice)}</span></div>
                    <div className="col-span-2"><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">الشاصية / الأبعاد</span><span className="font-medium text-slate-700 text-sm">{item.chassis} | {item.length}x{item.width}x{item.height}</span></div>
                    {item.notes && <div className="col-span-2"><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">ملاحظات</span><span className="text-slate-700 text-sm">{item.notes}</span></div>}
                    
                    {item._inv && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">معلومات الفاتورة</span>
                        <div className="text-xs font-bold text-blue-700">INV: {item._inv.id} - {item._inv.customerName}</div>
                      </div>
                    )}
                    {item._so && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">معلومات النقل</span>
                        <div className="text-xs font-bold text-purple-700">SO: {item._so.id} - {item._so.driverName}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="flex gap-1">
                      {hasPermission('workOrders', 'print') && <button onClick={() => setPrintData({ type: 'WORK_ORDER', data: item._wo })} className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200 transition-colors" title="طباعة للتصنيع"><Printer className="w-4 h-4" /></button>}
                      {hasPermission('workOrders', 'delete') && <button onClick={() => { if (window.confirm('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟')) setWorkOrders(workOrders.filter(w => w.id !== item._woId)); }} className="bg-red-50 text-red-500 p-2 rounded hover:bg-red-100 transition-colors" title="إلغاء الأمر"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(item._woId, item.serialNumber)} className="text-xs px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 transition-colors font-bold">الحالة</button>
                      <button onClick={() => { setEditingEstimate(item); setEditingContext({ type: 'workOrder', woId: item._woId }); setViewState('calculator'); window.scrollTo(0,0); }} className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-colors shadow-sm">المواد</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
          {sortedFlattenedItems.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                  <Download className="w-4 h-4" /> تصدير Excel
                </button>
                <span className="text-sm text-slate-500 font-medium">
                  عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, sortedFlattenedItems.length)} من {sortedFlattenedItems.length} منتج
                </span>
              </div>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    السابق
                  </button>
                  <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                    {currentPage} / {totalPages}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


        {selectedItemsForInvoice.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 md:right-64 bg-white border-t border-slate-300 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] p-4 z-40">
            <div className="w-full 2xl:max-w-[1800px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="font-bold text-indigo-900 flex items-center gap-2"><span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">{selectedItemsForInvoice.length}</span> منتجات جاهزة للفوترة أو النقل</div>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                {mixedSaleStatus && (
                  <div className="text-red-600 font-bold px-4 py-2 bg-red-50 rounded-lg">لا يمكن تحديد منتجات مباعة وغير مباعة معاً</div>
                )}
                {allUnsold && (
                  <>
                    <CustomerSelect value={finalCustomer} onChange={setFinalCustomer} direction="up" />
                    <button onClick={createFinalInvoice} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2"><FileCheck2 className="w-5 h-5" /> إصدار فاتورة نهائية</button>
                  </>
                )}
                {allSold && (
                  <button onClick={() => {
                    if (selectedItemsFull.some(i => i.mfgStatus !== 'جاهز')) {
                      return alert('لا يمكن نقل المنتجات إلا بعد أن تصبح جاهزة.');
                    }
                    const uniqueCustomers = new Set(selectedItemsFull.map(i => i.inv?.customerName).filter(Boolean));
                    if (uniqueCustomers.size > 1) {
                      return alert('لا يمكن إنشاء أمر نقل واحد لمنتجات تابعة لزبائن مختلفين.');
                    }
                    setShowShippingModal(true);
                  }} className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2"><Truck className="w-5 h-5" /> إنشاء أمر نقل</button>
                )}
              </div>
            </div>
          </div>
        )}

        {showShippingModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-6 h-6 text-emerald-600" /> إنشاء أمر نقل وإيصال استلام</h2>
                <button onClick={() => setShowShippingModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">السائق / الناقل</label>
                    <DriverSelect value={driverId} onChange={setDriverId} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">الوجهة</label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
                      <input type="text" className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500" value={destination} onChange={e => setDestination(e.target.value)} placeholder="مثال: طرابلس - طريق الشط" />
                    </div>
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-4 text-slate-800">المنتجات المحملة ({selectedItemsForInvoice.length})</h3>
                <div className="space-y-4">
                  {workOrders.flatMap(wo => wo.items).filter(item => selectedItemsForInvoice.includes(item.serialNumber)).map(item => (
                    <div key={item.serialNumber} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-lg text-slate-800">{item.desc}</div>
                            <div className="text-sm text-slate-600">S/N: <span className="font-mono font-bold">{item.serialNumber}</span> | الشاصية: {item.chassis}</div>
                          </div>
                        </div>
                        <div className="w-full">
                          <label className="block text-sm font-bold text-slate-700 mb-2">المرفقات والمحتويات الداخلية (أثاث، معدات...)</label>
                          <textarea className="w-full p-3 border border-slate-300 rounded-lg outline-none text-sm focus:border-emerald-500" rows={2} placeholder="مثال: 3 كراسي، 1 طاولة، 1 مكيف" value={shippingContents[item.serialNumber] || ''} onChange={e => setShippingContents(prev => ({ ...prev, [item.serialNumber]: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-4">
                <button onClick={() => setShowShippingModal(false)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">إلغاء</button>
                <button onClick={generateShippingOrder} className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2"><Printer className="w-5 h-5" /> حفظ وطباعة أمر النقل</button>
              </div>
            </div>
          </div>
        )}
        {showLegacyImportModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Database className="w-6 h-6 text-slate-700" /> إدخال منتجات سابقة (أرصدة افتتاحية / جرد)</h2>
                  <p className="text-sm text-slate-500 mt-1">أدخل المنتجات القديمة بحالتها الحالية وأرقام تصنيعها القديمة لربطها بالنظام.</p>
                </div>
                <button onClick={() => setShowLegacyImportModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm mb-4">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 w-10"></th>
                      <th className="p-2 w-32">رقم التصنيع (SN)</th>
                      <th className="p-2">المنتج / الوصف</th>
                      <th className="p-2 w-24">الشاصية</th>
                      <th className="p-2 w-28">حالة التصنيع</th>
                      <th className="p-2 w-24">حالة البيع</th>
                      <th className="p-2 w-32">اسم الزبون (للمباع)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacyItems.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-2 text-center">
                          <button onClick={() => setLegacyItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none font-mono dir-ltr text-right" placeholder="SN-..." value={item.serialNumber} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, serialNumber: e.target.value } : i))} />
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none" placeholder="وصف المنتج..." value={item.desc} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, desc: e.target.value } : i))} />
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none" value={item.chassis} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, chassis: e.target.value } : i))} />
                        </td>
                        <td className="p-2">
                          <select className="w-full border border-slate-300 rounded p-1 outline-none" value={item.mfgStatus} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, mfgStatus: e.target.value } : i))}>
                            <option value="جاهز">جاهز</option>
                            <option value="قيد التصنيع">قيد التصنيع</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-1 px-2 rounded border border-slate-200">
                            <input type="checkbox" className="w-4 h-4" checked={item.isSold} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, isSold: e.target.checked } : i))} />
                            <span className="font-bold">مباع</span>
                          </label>
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none disabled:bg-slate-100 disabled:opacity-50" placeholder="اسم الزبون..." disabled={!item.isSold} value={item.customerName} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, customerName: e.target.value } : i))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
                <button onClick={() => setLegacyItems(prev => [...prev, { id: Date.now(), serialNumber: '', desc: '', chassis: '', length: '', width: '', height: '', sellPrice: '', mfgStatus: 'جاهز', isSold: false, customerName: '' }])} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 p-2 bg-blue-50 rounded-lg"><Plus className="w-4 h-4" /> إضافة صف آخر</button>
              </div>
              <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-4">
                <button onClick={() => setShowLegacyImportModal(false)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">إلغاء</button>
                <button onClick={handleSaveLegacyItems} className="bg-slate-800 text-white px-8 py-2 rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2"><Save className="w-5 h-5" /> حفظ الأرصدة المدخلة</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };