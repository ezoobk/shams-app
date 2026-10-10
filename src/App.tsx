import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import shamsLogo from './assets/shamsLogo.png';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Trash2, Edit, Package, Users,
  FileText, ShoppingCart, Settings, Printer, Download,
  X, Factory, LayoutDashboard, Check, Save, Copy, FileEdit, FileCheck2, Eye, EyeOff, Archive, ArrowUp, ArrowDown, ChevronUp, ChevronDown, ChevronsUpDown, List, Grid, Truck, MapPin, RefreshCw, Database, Mail, FilterX, Tags
} from 'lucide-react';

import { formatCurrency, numberToArabicWords } from './utils/formatters';

import { PortalDropdown } from './components/ui/PortalDropdown';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl max-w-4xl mx-auto mt-20" dir="ltr">
          <h1 className="text-3xl mb-4">Print Preview Crash</h1>
          <p className="mb-4 text-slate-800 font-mono text-sm">{this.state.error && this.state.error.toString()}</p>
          <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded overflow-auto h-[400px]">
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { useDatabaseObject } from './hooks/useDatabaseObject';
import { getMigrationStatus, checkServerHealth, isElectron, API_BASE_URL, setupRealtimeSync } from './api/client';

import { SettingsView } from './views/Settings/SettingsView';
import { CustomersView } from './views/Customers/CustomersView';
import { useCustomers } from './context/CustomersContext';
import { DriversView } from './views/Drivers/DriversView';
import { useDrivers } from './context/DriversContext';
import { useSettings } from './context/SettingsContext';
import { usePrint } from './context/PrintContext';
import { useMaterials } from './context/MaterialsContext';
import { useEstimates } from './context/EstimatesContext';
import { useWorkOrders } from './context/WorkOrdersContext';
import { useInvoices } from './context/InvoicesContext';
import { LettersView } from './views/Letters/LettersView';
import { CustomerSelect } from './components/ui/CustomerSelect';
import { MaterialsView } from './views/Materials/MaterialsView';
import { EstimatesView } from './views/Estimates/EstimatesView';
import { CostCalculatorView } from './views/Estimates/CostCalculatorView';
import { EstimateCategoriesView } from './views/Estimates/EstimateCategoriesView';
import { WorkOrdersView } from './views/WorkOrders/WorkOrdersView';
import { InvoiceEditorView } from './views/Invoices/InvoiceEditorView';
import { OutboundLogView } from './views/Invoices/OutboundLogView';
import { WorksOfView } from './views/WorksOf/WorksOfView';
import { DashboardView } from './views/Dashboard/DashboardView';
import { DriverSelect } from './components/ui/DriverSelect';

import { useLocalStorage } from './hooks/useLocalStorage';
import { useAuth } from './context/AuthContext';
import { LoginView } from './views/Auth/LoginView';
import { UsersView } from './views/Auth/UsersView';
import { UserCog, LogOut, ShieldOff } from 'lucide-react';



export default function App() {
  const { currentUser, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorage('shams_activeTab', 'dashboard');
  const [tabStates, setTabStates] = useState({});
  const viewState = tabStates[activeTab] || 'list';
  const setViewState = (state) => setTabStates(prev => ({ ...prev, [activeTab]: state }));
  const { printData, setPrintData } = usePrint();
  const [excludedPages, setExcludedPages] = useState([]);


  const isPermitted = hasPermission(activeTab, 'view');

  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape' && printData) setPrintData(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [printData]);
  
  const [migrationToast, setMigrationToast] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // Migration notification (first run after JSON → SQLite migration)
    getMigrationStatus().then(status => {
      if (status) {
        setMigrationToast(true);
        setTimeout(() => setMigrationToast(false), 10000);
      }
    });

    // For browser clients: check server connectivity once on mount
    if (!isElectron()) {
      checkServerHealth().then(online => setServerOnline(online));
      // Setup Server-Sent Events (Real-time sync)
      return setupRealtimeSync();
    } else {
      setServerOnline(true); // Electron is always local
      return setupRealtimeSync();
    }
  }, []);

  const [selectedWorkId, setSelectedWorkId] = useState(null);

  const { appSettings, setAppSettings, idCountersRef: idCounters, generateId } = useSettings();
  const { customers, setCustomers } = useCustomers();
  const { drivers, setDrivers } = useDrivers();
  const [shippingOrders, setShippingOrders] = useDatabaseObject('shams_shippingOrders', []);
  const { masterMaterials, setMasterMaterials, worksOf, setWorksOf, masterItems, setMasterItems } = useMaterials();
  const { estimates, setEstimates, estimateCategories, setEstimateCategories, cart, setCart, editingEstimate, setEditingEstimate, editingContext, setEditingContext, calculatorDraftRef } = useEstimates();
  const { workOrders, setWorkOrders } = useWorkOrders();
  const { invoices, setInvoices, deletedInvoices, setDeletedInvoices } = useInvoices();
  const [letters, setLetters] = useDatabaseObject('shams_letters', []);
  const [savedNotes, setSavedNotes] = useDatabaseObject('shams_savedNotes', []);
  const [savedTerms, setSavedTerms] = useDatabaseObject('shams_savedTerms', []);
  const [editingInvoice, setEditingInvoice] = useState(null);

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


  const handleSavePDF = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.printToPDF) {
      const title = printData.data?.id ? `${printData.data.id}.pdf` : 'Document.pdf';
      const success = await electronAPI.printToPDF(title);
      if (success) setPrintData(null);
    } else {
      window.print();
    }
  };

  const handlePrintDirect = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.printDirect) {
      const originalTitle = document.title;
      if (printData.data && printData.data.id) document.title = printData.data.id;
      await electronAPI.printDirect();
      document.title = originalTitle;
      setTimeout(() => setPrintData(null), 1500);
    } else {
      window.print();
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const afterPrint = () => setPrintData(null);
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);

  useEffect(() => {
    if (printData && printData.silentExport) {
      // Find pages to exclude (all specs and attachments)
      const exclude = [];
      if (printData.type === 'INVOICE') {
        printData.data.items.forEach((item, idx) => {
          exclude.push(`spec-${idx}`);
          if (item.attachments) {
            item.attachments.forEach((_, attIdx) => {
              exclude.push(`att-${item.id}-${attIdx}`);
            });
          }
        });
      }
      setExcludedPages(exclude);

      // Give React time to render with excluded pages hidden
      setTimeout(async () => {
        if (window.electronAPI) {
          const fileName = `${printData.data.id}.pdf`;
          await window.electronAPI.exportPdfSilently(fileName, appSettings.outboundLogPath);
        }
        setPrintData(null);
        if (activeTab === 'invoices') {
          setEditingInvoice(null);
        }
      }, 800);
    } else {
      setExcludedPages([]);
    }
  }, [printData]);

  const PrintPageWrapper = ({ id, title, className, children }) => {
    const isExcluded = excludedPages.includes(id);
    return (
      <div className={`print-page relative ${className || ''} ${isExcluded ? 'opacity-30 grayscale print:hidden' : ''}`}>
        <div className={isExcluded ? 'pointer-events-none' : ''}>
           {children}
        </div>
      </div>
    );
  };

  if (printData) {
    const PrintInvoiceHeader = ({ docId, date, customer, type }) => (
      <div className="border-b-2 border-slate-800 pb-6 mb-8 mt-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1 text-right">
            <h2 className="text-2xl font-black text-slate-800 mb-2 leading-snug whitespace-pre-wrap">{appSettings.companyNameAr}</h2>
            <div className="text-slate-600 font-semibold space-y-1 text-sm mt-3">
              {appSettings.address && <div>{appSettings.address}</div>}
              {appSettings.cr && <div>{appSettings.cr}</div>}
              {appSettings.phones && <div dir="ltr" className="text-right">{appSettings.phones}</div>}
            </div>
          </div>
          <div className="mx-8 flex-shrink-0">
            <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-32 w-auto object-contain" />
          </div>
          <div className="flex-1 text-left" dir="ltr">
            <h2 className="text-xl font-black text-slate-800 mb-2 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
            <div className="text-slate-600 font-semibold space-y-1 text-sm mt-3">
              {appSettings.email && <div>{appSettings.email}</div>}
              {appSettings.website && <div>{appSettings.website}</div>}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">فاتورة {type}</h1>
            <div className="text-lg text-slate-700">رقم المستند: <span className="font-mono font-bold text-slate-900">{docId}</span></div>
            <div className="text-lg text-slate-700">التاريخ: <span className="font-semibold text-slate-900">{new Date(date).toLocaleDateString('ar-LY')}</span></div>
          </div>
          {customer && (
            <div className="text-left">
              <div className="text-lg text-slate-700 mb-1">السادة / <span className="font-bold text-xl text-slate-900">{customer}</span> المحترمين</div>
            </div>
          )}
        </div>
      </div>
    );

    const PrintWOHeader = () => (
      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8 mt-4">
        <div className="flex-1 text-right">
          <h2 className="text-2xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameAr}</h2>
        </div>
        <div className="mx-8 flex-shrink-0">
          <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-24 w-auto object-contain" />
        </div>
        <div className="flex-1 text-left" dir="ltr">
          <h2 className="text-xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
        </div>
      </div>
    );

    const groupedPrintItems = printData.type.includes('INVOICE') ? Object.values(printData.data.items.reduce((acc, item) => {
      const key = `${item.desc}_${item.chassis}_${item.length}_${item.width}_${item.height}_${item.sellPrice}`;
      if (!acc[key]) { acc[key] = { ...item, requestedQty: 0, serialNumbers: [] }; }
      acc[key].requestedQty += Number(item.requestedQty || 1);
      if (item.serialNumber) acc[key].serialNumbers.push(item.serialNumber);
      return acc;
    }, {})) : [];

    const availablePages = [];
    if (printData.type === 'LETTER') {
      availablePages.push({ id: 'letter-main', title: `رسالة: ${printData.data.subject}` });
    } else if (printData.type === 'ESTIMATE') {
      availablePages.push({ id: 'est-main', title: `تقدير تكلفة: ${printData.data.desc}` });
      if (printData.data.attachments) {
        printData.data.attachments.filter(att => att.type.startsWith('image/')).forEach((att, attIdx) => {
          availablePages.push({ id: `est-att-${attIdx}`, title: `مرفق تقدير` });
        });
      }
    } else if (printData.type === 'WORK_ORDER') {
      printData.data.items.forEach((item, idx) => {
        availablePages.push({ id: `wo-${item.serialNumber}`, title: `أمر تصنيع: ${item.desc}` });
        if (item.attachments) {
          item.attachments.filter(att => att.type.startsWith('image/')).forEach((att, attIdx) => {
            availablePages.push({ id: `wo-att-${item.serialNumber}-${attIdx}`, title: `مرفق أمر تصنيع` });
          });
        }
      });
    } else if (printData.type.includes('INVOICE')) {
      availablePages.push({ id: `main-invoice`, title: `الفاتورة الرئيسية` });
      printData.data.items.forEach((item, idx) => {
        if (!item.isCustom) {
          const visibleMaterials = (item.materials || []).filter(m => m.isVisible !== false);
          if (visibleMaterials.length > 0) {
            availablePages.push({ id: `spec-${idx}`, title: `مواصفات: ${item.desc}` });
          }
        }
        if (item.attachments) {
          item.attachments.filter(att => att.type.startsWith('image/')).forEach((att, attIdx) => {
            availablePages.push({ id: `att-${item.id}-${attIdx}`, title: `مرفق الفاتورة` });
          });
        }
      });
    }

    return (
      <ErrorBoundary>
      <div className="bg-white min-h-screen text-black font-sans pb-20 print:pb-0 print:min-h-0 print:h-auto" dir="rtl">
        <div className="print:hidden fixed top-0 left-0 w-full bg-slate-900 text-white p-4 shadow-xl flex flex-col gap-4 z-50 max-h-[40vh] overflow-y-auto">
          <div className="flex justify-between items-center">
            <div className="font-bold flex items-center gap-2"><Printer className="w-5 h-5 text-blue-400" /> معاينة الطباعة للنسخة الورقية</div>
            <div className="flex gap-4">
              <button onClick={() => setPrintData(null)} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-lg font-bold transition-colors">إلغاء والرجوع</button>
              <button onClick={handleSavePDF} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><Download className="w-5 h-5" /> حفظ كـ PDF</button>
              <button onClick={handlePrintDirect} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><Printer className="w-5 h-5" /> طباعة مباشرة (تحديد طابعة)</button>
            </div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-wrap gap-2 items-center">
            <div className="text-sm font-bold text-slate-300 ml-2">تضمين في الطباعة:</div>
            {availablePages.map(page => {
              const isExcluded = excludedPages.includes(page.id);
              return (
                <label key={page.id} className={`flex items-center gap-2 text-sm cursor-pointer select-none px-4 py-1.5 rounded-full border transition-colors ${isExcluded ? 'bg-slate-700 border-slate-600 text-slate-400 line-through' : 'bg-blue-600 border-blue-500 text-white font-bold hover:bg-blue-500'}`}>
                  <input type="checkbox" className="hidden" checked={!isExcluded} onChange={() => {
                    setExcludedPages(prev => isExcluded ? prev.filter(p => p !== page.id) : [...prev, page.id]);
                  }} />
                  {page.title}
                </label>
              );
            })}
          </div>
        </div>
        <div className="p-8 pt-[140px] print:p-8 print:pt-8">
        {printData.type === 'WORK_ORDER' && printData.data.items.map((item, idx) => (
          <PrintPageWrapper key={item.serialNumber} id={`wo-${item.serialNumber}`} title={`أمر تصنيع: ${item.desc}`} className={idx > 0 ? 'print:break-before-page mt-16' : ''}>
            <PrintWOHeader />
            <div className="flex justify-between items-end mb-6">
              <h1 className="text-2xl font-black text-slate-900">أمر تصنيع (Work Order)</h1>
              <div className="text-lg text-slate-700">تاريخ الأمر: <span className="font-semibold text-slate-900">{new Date(printData.data.date).toLocaleDateString('ar-LY')}</span></div>
            </div>
            <div className="bg-slate-100 p-4 border border-slate-300 rounded mb-6 text-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>المنتج / الوصف: <span className="font-bold">{item.desc}</span></div>
                <div>الرقم التسلسلي: <span className="font-mono font-bold">{item.serialNumber}</span></div>
                <div>الشاصية: <span className="font-bold">{item.chassis}</span></div>
                <div>الأبعاد: <span className="font-bold">{item.length}x{item.width}x{item.height}m</span></div>
                <div className="col-span-2">الكمية المطلوبة: <span className="font-bold">1</span></div>
                {item.notes && <div className="col-span-2 bg-yellow-100 p-2 rounded text-yellow-900">ملاحظات: <span className="font-bold">{item.notes}</span></div>}
              </div>
            </div>
            <h3 className="text-xl font-bold mb-4">قائمة المواد المطلوبة للتصنيع:</h3>
            {worksOf.map(w => {
              const sectionMats = item.materials.filter(m => m.worksOf === w.id);
              if (sectionMats.length === 0) return null;
              return (
                <div key={w.id} className="mb-6">
                  <h3 className="text-lg font-bold mb-0 p-2 bg-slate-200 border border-slate-400 border-b-0 rounded-t">{w.name}</h3>
                  <table className="w-full text-right border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 border-y border-slate-400">
                        <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                        <th className="p-2 border-l border-slate-400 w-1/3">البند</th>
                        <th className="p-2 border-l border-slate-400 w-1/3">المادة</th>
                        <th className="p-2 text-center w-24">الكمية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionMats.map((mat, i) => (
                        <tr key={i} className="border-b border-slate-300">
                          <td className="p-2 border-l border-slate-300 text-center">{i + 1}</td>
                          <td className="p-2 border-l border-slate-300 font-bold">{mat.itemName || '-'}</td>
                          <td className="p-2 border-l border-slate-300">{mat.fullName || mat.name || '--- لم يحدد ---'}</td>
                          <td className="p-2 text-center font-bold">{mat.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {item.materials.filter(m => !m.worksOf).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-0 p-2 bg-slate-200 border border-slate-400 border-b-0 rounded-t">أخرى</h3>
                <table className="w-full text-right border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-400">
                      <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                      <th className="p-2 border-l border-slate-400 w-1/3">البند</th>
                      <th className="p-2 border-l border-slate-400 w-1/3">المادة</th>
                      <th className="p-2 text-center w-24">الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.materials.filter(m => !m.worksOf).map((mat, i) => (
                      <tr key={i} className="border-b border-slate-300">
                        <td className="p-2 border-l border-slate-300 text-center">{i + 1}</td>
                        <td className="p-2 border-l border-slate-300 font-bold">{mat.itemName || '-'}</td>
                        <td className="p-2 border-l border-slate-300">{mat.fullName || mat.name || '--- لم يحدد ---'}</td>
                        <td className="p-2 text-center font-bold">{mat.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PrintPageWrapper>
        ))}
        {printData.type === 'WORK_ORDER' && printData.data.items.map((item) =>
          item.attachments && item.attachments.filter(att => att.type.startsWith('image/')).map((att, attIdx) => (
            <PrintPageWrapper key={`wo-att-${item.serialNumber || attIdx}`} id={`wo-att-${item.serialNumber}-${attIdx}`} title={`مرفق أمر تصنيع`} className="print:break-before-page w-full h-[95vh] print:h-[95vh] flex flex-col items-center justify-center p-8">
              <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 w-full border-b pb-4">مرفق: {item.desc} {item.serialNumber ? `(SN: ${item.serialNumber})` : ''}</h2>
              <img src={att.data} alt={att.name} className="max-w-full max-h-full object-contain" style={{ maxHeight: '85vh' }} />
            </PrintPageWrapper>
          ))
        )}

        {printData.type.includes('INVOICE') && (
          <PrintPageWrapper id="main-invoice" title="الفاتورة الرئيسية">
            <PrintInvoiceHeader docId={printData.data.id} date={printData.data.date} customer={printData.data.customerName} type={printData.data.type} />
            <table className="w-full text-right border-collapse mb-8">
              <thead>
                <tr className="bg-slate-200 border-y border-slate-800">
                  <th className="p-3 border-l border-slate-400 text-center w-12">#</th>
                  <th className="p-3 border-l border-slate-400 w-1/2">البيان / المنتج</th>
                  <th className="p-3 border-l border-slate-400 text-center">الكمية</th>
                  <th className="p-3 border-l border-slate-400 text-center">سعر الوحدة</th>
                  <th className="p-3 text-center">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {groupedPrintItems.map((item, i) => (
                  <tr key={i} className="border-b border-slate-300">
                    <td className="p-3 border-l border-slate-300 text-center">{i + 1}</td>
                    <td className="p-3 border-l border-slate-300">
                      <div className="font-bold text-lg">{item.desc}</div>
                      {!item.isCustom && (
                        <>
                          <div className="text-sm text-slate-700 mt-1">الشاصية: <span className="font-semibold">{item.chassis}</span> | الأبعاد: <span className="font-semibold">{item.length}x{item.width}x{item.height}m</span></div>
                          {printData.data.type === 'نهائية' && item.serialNumbers?.length > 0 && (
                            <div className="text-sm mt-1 font-mono text-slate-600 bg-slate-100 inline-block px-2 rounded">S/N: {item.serialNumbers.join(', ')}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-3 text-center border-l border-slate-300 font-bold text-lg align-middle">{item.requestedQty}</td>
                    <td className="p-3 text-center border-l border-slate-300 dir-ltr font-semibold align-middle">{formatCurrency(item.sellPrice)}</td>
                    <td className="p-3 text-center font-bold dir-ltr align-middle">{formatCurrency(item.sellPrice * item.requestedQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-6">
              <div className="flex-1 flex flex-col gap-4">
                {printData.data.notes && (
                  <div className="border border-slate-300 rounded p-3 bg-slate-50 flex-1">
                    <h3 className="font-bold border-b border-slate-300 pb-1 mb-2">ملاحظات</h3>
                    <div className="text-sm whitespace-pre-wrap">{printData.data.notes}</div>
                  </div>
                )}
                {printData.data.terms && (
                  <div className="border border-slate-300 rounded p-3 bg-slate-50 flex-1">
                    <h3 className="font-bold border-b border-slate-300 pb-1 mb-2">الشروط والأحكام</h3>
                    <div className="text-sm whitespace-pre-wrap">{printData.data.terms}</div>
                  </div>
                )}
              </div>
              <div className="w-1/2 shrink-0 border-2 border-slate-800 rounded p-4 h-max">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">المجموع:</span>
                  <span className="dir-ltr">{formatCurrency(printData.data.total)}</span>
                </div>
                <div className="flex justify-between mb-2 text-red-600 border-b border-slate-300 pb-2">
                  <span className="font-semibold">التخفيض:</span>
                  <span className="dir-ltr">- {formatCurrency(printData.data.discount || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 text-xl font-bold">
                  <span>الصافي:</span>
                  <span className="dir-ltr">{formatCurrency(printData.data.netTotal)}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-300 text-sm font-bold text-center bg-slate-100 p-2 rounded">
                  {numberToArabicWords(printData.data.netTotal)}
                </div>
              </div>
            </div>
          </PrintPageWrapper>
        )}

        {printData.type.includes('INVOICE') && printData.data.items.map((item, idx) => {
          if (item.isCustom) return null;
          const visibleMaterials = (item.materials || []).filter(m => m.isVisible !== false);
          if (visibleMaterials.length === 0) return null;

          return (
            <PrintPageWrapper key={`attach-${idx}`} id={`spec-${idx}`} title={`مواصفات: ${item.desc}`} className="print:break-before-page mt-16 pt-8 border-t-2 border-dashed border-slate-400">
              <h2 className="text-2xl font-bold mb-6 text-center bg-slate-800 text-white py-2 rounded">مواصفات وتفاصيل البند</h2>
              <div className="bg-slate-50 p-4 border border-slate-300 rounded mb-6 text-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>المنتج / الوصف: <span className="font-bold">{item.desc}</span></div>
                  <div>الشاصية: <span className="font-bold">{item.chassis}</span></div>
                  <div>الأبعاد: <span className="font-bold">{item.length}x{item.width}x{item.height}m</span></div>
                  {printData.data.type === 'مبدئية' && <div>الكمية: <span className="font-bold">{item.requestedQty}</span></div>}
                  {printData.data.type === 'نهائية' && <div>الرقم التسلسلي: <span className="font-bold font-mono">{item.serialNumber}</span></div>}
                </div>
              </div>
              {worksOf.map(w => {
                const sectionMats = visibleMaterials.filter(m => m.worksOf === w.id && Number(m.qty) > 0 && m.name && m.name.trim() !== '');
                if (sectionMats.length === 0) return null;
                return (
                  <div key={w.id} className="mb-6">
                    <h3 className="text-lg font-bold mb-0 p-2 bg-slate-200 border border-slate-400 border-b-0 rounded-t">{w.name}</h3>
                    <table className="w-full text-right border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-100 border-y border-slate-400">
                          <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                          <th className="p-2 border-l border-slate-400">البيان / المواصفات</th>
                          <th className="p-2 text-center w-32">الكمية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionMats.map((mat, i) => (
                          <tr key={i} className="border-b border-slate-300">
                            <td className="p-2 border-l border-slate-300 text-center">{i + 1}</td>
                            <td className="p-2 border-l border-slate-300 font-semibold">{mat.itemName} {(mat.itemName && (mat.fullName || mat.name)) ? '-' : ''} {mat.fullName || mat.name}</td>
                            <td className="p-2 text-center font-bold text-lg">{mat.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {visibleMaterials.filter(m => !m.worksOf && Number(m.qty) > 0 && m.name && m.name.trim() !== '').length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-0 p-2 bg-slate-200 border border-slate-400 border-b-0 rounded-t">أخرى</h3>
                  <table className="w-full text-right border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 border-y border-slate-400">
                        <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                        <th className="p-2 border-l border-slate-400">البيان / المواصفات</th>
                        <th className="p-2 text-center w-32">الكمية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMaterials.filter(m => !m.worksOf && Number(m.qty) > 0 && m.name && m.name.trim() !== '').map((mat, i) => (
                        <tr key={i} className="border-b border-slate-300">
                          <td className="p-2 border-l border-slate-300 text-center">{i + 1}</td>
                          <td className="p-2 border-l border-slate-300 font-semibold">{mat.itemName} {(mat.itemName && (mat.fullName || mat.name)) ? '-' : ''} {mat.fullName || mat.name}</td>
                          <td className="p-2 text-center font-bold text-lg">{mat.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PrintPageWrapper>
          );
        })}
        {printData.type.includes('INVOICE') && printData.data.items.map((item) =>
          item.attachments && item.attachments.filter(att => att.type.startsWith('image/')).map((att, attIdx) => (
            <PrintPageWrapper key={`inv-att-${item.id || attIdx}`} id={`att-${item.id}-${attIdx}`} title={`مرفق الفاتورة`} className="print:break-before-page w-full h-[95vh] print:h-[95vh] flex flex-col items-center justify-center p-8">
              <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 w-full border-b pb-4">مرفق: {item.desc} {item.serialNumber ? `(SN: ${item.serialNumber})` : ''}</h2>
              <img src={att.data} alt={att.name} className="max-w-full max-h-full object-contain" style={{ maxHeight: '85vh' }} />
            </PrintPageWrapper>
          ))
        )}

        {printData.type === 'SHIPPING_ORDER' && (
          <>
            <PrintPageWrapper id="shipping-order-driver" title="أمر نقل - نسخة السائق" className="print:break-after-page">
              <div className="border-b-2 border-slate-800 pb-6 mb-6 mt-4 flex justify-between items-center">
                <div className="flex-1 text-right">
                  <h2 className="text-2xl font-black text-slate-800 mb-2 leading-snug">{appSettings.companyNameAr}</h2>
                  <div className="text-slate-600 font-semibold text-sm mt-3">{appSettings.address}</div>
                </div>
                <div className="mx-8 flex-shrink-0"><img src={appSettings.logoBase64 || shamsLogo} alt="Logo" className="h-24 w-auto object-contain" /></div>
                <div className="flex-1 text-left" dir="ltr">
                  <h2 className="text-xl font-black text-slate-800 mb-2 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
                </div>
              </div>

              <div className="text-center mb-6">
                <h1 className="text-2xl font-black text-slate-900 mb-2 underline">أمر نقل منتجات (نسخة السائق / المصنع)</h1>
                <div className="text-slate-600">التاريخ: {new Date(printData.data.date).toLocaleDateString('ar-LY')} | المرجع: <span className="font-mono">{printData.data.id}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-300">
                <div>
                  <h3 className="font-bold text-slate-500 mb-2 border-b pb-1">بيانات التوصيل والزبون</h3>
                  <div className="space-y-1">
                    <div>الوجهة: <span className="font-bold text-slate-800">{printData.data.destination}</span></div>
                    <div>اسم الزبون: <span className="font-bold text-slate-800">{printData.data.customerName}</span></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-500 mb-2 border-b pb-1">بيانات السائق / الناقل</h3>
                  <div className="space-y-1">
                    <div>الاسم: <span className="font-bold text-slate-800">{printData.data.driver?.name}</span></div>
                    {printData.data.driver?.license && <div>الرخصة: <span className="font-bold text-slate-800">{printData.data.driver?.license}</span></div>}
                    <div>السيارة: <span className="font-bold font-mono">{printData.data.driver?.truckNumber}</span></div>
                    {printData.data.driver?.trailerNumber && <div>المقطورة: <span className="font-bold font-mono">{printData.data.driver?.trailerNumber}</span></div>}
                  </div>
                </div>
              </div>

              <table className="w-full text-right border-collapse mb-6 border-2 border-slate-800 text-sm">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-800">
                    <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                    <th className="p-2 border-l border-slate-400 w-1/3">المنتج والمواصفات</th>
                    <th className="p-2 border-l border-slate-400">المرفقات والمحتويات الداخلية</th>
                    <th className="p-2 border-l border-slate-400 text-center w-40">SN (رقم التصنيع)</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.data.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-400">
                      <td className="p-2 border-l border-slate-400 text-center font-bold">{idx + 1}</td>
                      <td className="p-2 border-l border-slate-400">
                        <div className="font-bold mb-1">{item.desc || item.name}</div>
                        <div className="text-xs font-semibold text-slate-700">الشاصية: {item.chassis} | الأبعاد: {item.length}x{item.width}x{item.height}m</div>
                      </td>
                      <td className="p-2 border-l border-slate-400 font-semibold whitespace-pre-wrap leading-relaxed">{item.contents || '-'}</td>
                      <td className="p-2 border-l border-slate-400 text-center font-mono font-bold">{item.serialNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-2 border-slate-800 rounded-xl p-4 bg-slate-50 break-inside-avoid">
                <h3 className="text-lg font-bold mb-2">إقرار الناقل (السائق)</h3>
                <p className="leading-relaxed mb-6">أقر أنا الموقع أدناه السيد / <span className="font-bold">{printData.data.driver?.name}</span>، بأنني استلمت المنتجات المذكورة أعلاه ومحتوياتها بحالة ممتازة وجاهزة للنقل إلى (<span className="font-bold">{printData.data.destination}</span>) تحت مسؤوليتي الكاملة.</p>
                <div className="flex justify-between items-end px-8">
                  <div className="text-center"><div className="font-bold mb-6">توقيع المستلم (السائق)</div><div className="border-b-2 border-slate-800 w-48"></div></div>
                  <div className="text-center"><div className="font-bold mb-6">اعتماد التسليم (المصنع)</div><div className="border-b-2 border-slate-800 w-48"></div></div>
                </div>
              </div>
            </PrintPageWrapper>

            <PrintPageWrapper id="shipping-order-customer" title="إيصال استلام - الزبون">
              <div className="border-b-2 border-slate-800 pb-6 mb-6 mt-4 flex justify-between items-center">
                <div className="flex-1 text-right">
                  <h2 className="text-2xl font-black text-slate-800 mb-2 leading-snug">{appSettings.companyNameAr}</h2>
                  <div className="text-slate-600 font-semibold text-sm mt-3">{appSettings.address}</div>
                </div>
                <div className="mx-8 flex-shrink-0"><img src={appSettings.logoBase64 || shamsLogo} alt="Logo" className="h-24 w-auto object-contain" /></div>
                <div className="flex-1 text-left" dir="ltr">
                  <h2 className="text-xl font-black text-slate-800 mb-2 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
                </div>
              </div>

              <div className="text-center mb-6">
                <h1 className="text-2xl font-black text-slate-900 mb-2 underline">إيصال استلام منتجات (نسخة الزبون)</h1>
                <div className="text-slate-600">التاريخ: {new Date(printData.data.date).toLocaleDateString('ar-LY')} | المرجع: <span className="font-mono">{printData.data.id}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-300">
                <div>
                  <h3 className="font-bold text-slate-500 mb-2 border-b pb-1">بيانات التوصيل والزبون</h3>
                  <div className="space-y-1">
                    <div>الوجهة: <span className="font-bold text-slate-800">{printData.data.destination}</span></div>
                    <div>اسم الزبون: <span className="font-bold text-slate-800">{printData.data.customerName}</span></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-500 mb-2 border-b pb-1">بيانات السائق / الناقل</h3>
                  <div className="space-y-1">
                    <div>الاسم: <span className="font-bold text-slate-800">{printData.data.driver?.name}</span></div>
                    {printData.data.driver?.license && <div>الرخصة: <span className="font-bold text-slate-800">{printData.data.driver?.license}</span></div>}
                    <div>السيارة: <span className="font-bold font-mono">{printData.data.driver?.truckNumber}</span></div>
                    {printData.data.driver?.trailerNumber && <div>المقطورة: <span className="font-bold font-mono">{printData.data.driver?.trailerNumber}</span></div>}
                  </div>
                </div>
              </div>

              <table className="w-full text-right border-collapse mb-6 border-2 border-slate-800 text-sm">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-800">
                    <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                    <th className="p-2 border-l border-slate-400 w-1/3">المنتج والمواصفات</th>
                    <th className="p-2 border-l border-slate-400">المرفقات والمحتويات الداخلية</th>
                    <th className="p-2 border-l border-slate-400 text-center w-40">SN (رقم التصنيع)</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.data.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-400">
                      <td className="p-2 border-l border-slate-400 text-center font-bold">{idx + 1}</td>
                      <td className="p-2 border-l border-slate-400">
                        <div className="font-bold mb-1">{item.desc || item.name}</div>
                        <div className="text-xs font-semibold text-slate-700">الشاصية: {item.chassis} | الأبعاد: {item.length}x{item.width}x{item.height}m</div>
                      </td>
                      <td className="p-2 border-l border-slate-400 font-semibold whitespace-pre-wrap leading-relaxed">{item.contents || '-'}</td>
                      <td className="p-2 border-l border-slate-400 text-center font-mono font-bold">{item.serialNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-2 border-slate-800 rounded-xl p-4 bg-slate-50 break-inside-avoid">
                <h3 className="text-lg font-bold mb-2">إقرار استلام الزبون</h3>
                <p className="leading-relaxed mb-6">أقر أنا الموقع أدناه بأنني استلمت المنتجات المذكورة أعلاه بجميع مرفقاتها ومحتوياتها الموضحة في هذا الإيصال، وهي بحالة ممتازة وبدون أي عيوب أو أضرار ظاهرة.</p>
                <div className="grid grid-cols-2 gap-8 mb-4 px-8">
                  <div className="space-y-4">
                    <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">اسم المستلم:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                    <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">الصفة:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                    <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">تاريخ الاستلام:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                    <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">التوقيع:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                  </div>
                  <div></div>
                </div>
              </div>
            </PrintPageWrapper>
          </>
        )}
        {printData.type === 'LETTER' && (
          <PrintPageWrapper id="letter-main" title={`رسالة: ${printData.data.subject}`}>
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8 mt-4">
              <div className="flex-1 text-right">
                <h2 className="text-2xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameAr}</h2>
                <div className="text-slate-600 mt-2 text-sm whitespace-pre-wrap">{appSettings.address}<br/>{appSettings.phones}<br/>{appSettings.cr}</div>
              </div>
              <div className="flex-shrink-0 mx-8">
                <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-28 w-auto object-contain" />
              </div>
              <div className="flex-1 text-left dir-ltr">
                <h2 className="text-2xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
                <div className="text-slate-600 mt-2 text-sm whitespace-pre-wrap">{appSettings.email}<br/>{appSettings.website}</div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500">الرقم الإشاري (Ref):</span>
                  <span className="text-lg font-bold font-mono">{printData.data.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500">التاريخ (Date):</span>
                  <span className="text-lg font-bold font-mono">{new Date(printData.data.date).toLocaleDateString('ar-LY')}</span>
                </div>
              </div>
            </div>

            <div className="mb-2 text-2xl font-black text-slate-900">
              الموضوع: {printData.data.subject}
            </div>

            <div className="mb-6 text-xl font-bold text-slate-800">
              إلى السادة / {printData.data.customerName}
            </div>

            <div className="min-h-[400px] flex flex-col space-y-3">
              {printData.data.blocks ? (
                printData.data.blocks.map(block => {
                  if (block.type === 'header') return <h3 key={block.id} className="text-2xl font-black text-slate-900 border-b-2 border-slate-200 pb-2 mb-2">{block.content}</h3>;
                  if (block.type === 'text') return <div key={block.id} className="text-lg leading-loose text-slate-800 whitespace-pre-wrap font-medium">{block.content}</div>;
                  if (block.type === 'list') return <ul key={block.id} className="list-disc list-inside space-y-2 text-lg text-slate-800 font-medium">{block.content.map((li, i) => <li key={i}>{li}</li>)}</ul>;
                  if (block.type === 'table') return (
                    <div key={block.id} className="w-full">
                      <table className="w-full text-right border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-100">
                            {block.content.headers.map((h, i) => <th key={i} className="p-3 border border-slate-800 font-bold text-slate-900">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {block.content.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => <td key={cIdx} className="p-3 border border-slate-800 text-slate-800 font-medium whitespace-pre-wrap">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                  return null;
                })
              ) : (
                <>
                  {printData.data.body && (
                    <div className="text-lg leading-loose text-slate-800 whitespace-pre-wrap font-medium mb-6">
                      {printData.data.body}
                    </div>
                  )}
                  {printData.data.bodyTop && (
                    <div className="text-lg leading-loose text-slate-800 whitespace-pre-wrap font-medium mb-6">
                      {printData.data.bodyTop}
                    </div>
                  )}
                  
                  {printData.data.hasTable && printData.data.table && (
                    <div className="mb-6">
                      <table className="w-full text-right border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-100">
                            {printData.data.table.headers.map((h, i) => (
                              <th key={i} className="p-3 border border-slate-800 font-bold text-slate-900">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {printData.data.table.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-3 border border-slate-800 text-slate-800 font-medium whitespace-pre-wrap">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {printData.data.bodyBottom && (
                    <div className="text-lg leading-loose text-slate-800 whitespace-pre-wrap font-medium mt-auto">
                      {printData.data.bodyBottom}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-12 pt-4 flex justify-end">
               <div className="text-center w-1/3">
                 <div className="font-bold text-slate-900 text-lg mb-1">{printData.data.senderName}</div>
                 <div className="text-slate-600 mb-8">{printData.data.senderTitle}</div>
                 <div className="border-t-2 border-slate-400 pt-2 font-bold text-slate-700">الختم والتوقيع</div>
               </div>
            </div>
          </PrintPageWrapper>
        )}

        {printData.type === 'ESTIMATE' && (
          <>
            <PrintPageWrapper id="est-main" title={`تقدير تكلفة: ${printData.data.desc}`}>
              <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8 mt-4">
                <div className="flex-1 text-right">
                  <h2 className="text-2xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameAr}</h2>
                </div>
                <div className="mx-8 flex-shrink-0">
                  <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-24 w-auto object-contain" />
                </div>
                <div className="flex-1 text-left" dir="ltr">
                  <h2 className="text-xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
                </div>
              </div>
              <div className="flex justify-between items-end mb-6">
                <h1 className="text-2xl font-black text-slate-900">عرض سريع / تقدير تكلفة</h1>
                <div className="text-lg text-slate-700">تاريخ التحديث: <span className="font-semibold text-slate-900">{new Date(printData.data.lastUpdated || printData.data.id).toLocaleDateString('ar-LY')}</span></div>
              </div>
              <div className="bg-slate-100 p-4 border border-slate-300 rounded mb-6 text-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>المنتج / الوصف: <span className="font-bold">{printData.data.desc}</span></div>
                  <div>الشاصية: <span className="font-bold">{printData.data.chassis}</span></div>
                  <div>الأبعاد: <span className="font-bold">{printData.data.length}x{printData.data.width}x{printData.data.height}m</span></div>
                  {printData.data.notes && <div className="col-span-2 bg-yellow-100 p-2 rounded text-yellow-900">ملاحظات: <span className="font-bold">{printData.data.notes}</span></div>}
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4">قائمة المواد المطلوبة (ذات القيمة):</h3>
              {worksOf.map(w => {
                const sectionMats = printData.data.materials.filter(m => m.worksOf === w.id && (Number(m.price) > 0 || Number(m.qty) > 0));
                if (sectionMats.length === 0) return null;
                return (
                  <div key={w.id} className="mb-6">
                    <h3 className="text-lg font-bold mb-0 p-2 bg-slate-200 border border-slate-400 border-b-0 rounded-t">{w.name}</h3>
                    <table className="w-full text-right border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-100 border-y border-slate-400">
                          <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                          <th className="p-2 border-l border-slate-400 w-1/4">البند</th>
                          <th className="p-2 border-l border-slate-400 w-1/4">المادة</th>
                          <th className="p-2 border-l border-slate-400 text-center w-24">الكمية</th>
                          <th className="p-2 border-l border-slate-400 text-center w-32">السعر</th>
                          <th className="p-2 text-center w-32">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionMats.map((mat, i) => (
                          <tr key={i} className="border-b border-slate-300">
                            <td className="p-2 border-l border-slate-300 text-center">{i + 1}</td>
                            <td className="p-2 border-l border-slate-300 font-bold">{mat.itemName || '-'}</td>
                            <td className="p-2 border-l border-slate-300">{mat.fullName || mat.name || '--- لم يحدد ---'}</td>
                            <td className="p-2 border-l border-slate-300 text-center font-bold">{mat.qty}</td>
                            <td className="p-2 border-l border-slate-300 text-center font-bold dir-ltr">{formatCurrency(mat.price)}</td>
                            <td className="p-2 text-center font-bold dir-ltr text-blue-800 bg-slate-50">{formatCurrency((mat.qty || 0) * (mat.price || 0))}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan="5" className="p-2 border-t border-l border-slate-400 font-bold text-left bg-slate-100 text-slate-700">إجمالي القسم:</td>
                          <td className="p-2 border-t border-slate-400 font-black text-center dir-ltr text-slate-900 bg-slate-200">{formatCurrency(sectionMats.reduce((sum, mat) => sum + ((mat.qty || 0) * (mat.price || 0)), 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {printData.data.materials.filter(m => !m.worksOf && (Number(m.price) > 0 || Number(m.qty) > 0)).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-0 p-2 bg-slate-200 border border-slate-400 border-b-0 rounded-t">أخرى</h3>
                  <table className="w-full text-right border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 border-y border-slate-400">
                        <th className="p-2 border-l border-slate-400 w-12 text-center">#</th>
                        <th className="p-2 border-l border-slate-400 w-1/4">البند</th>
                        <th className="p-2 border-l border-slate-400 w-1/4">المادة</th>
                        <th className="p-2 border-l border-slate-400 text-center w-24">الكمية</th>
                        <th className="p-2 border-l border-slate-400 text-center w-32">السعر</th>
                        <th className="p-2 text-center w-32">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printData.data.materials.filter(m => !m.worksOf && (Number(m.price) > 0 || Number(m.qty) > 0)).map((mat, i) => (
                        <tr key={i} className="border-b border-slate-300">
                          <td className="p-2 border-l border-slate-300 text-center">{i + 1}</td>
                          <td className="p-2 border-l border-slate-300 font-bold">{mat.itemName || '-'}</td>
                          <td className="p-2 border-l border-slate-300">{mat.fullName || mat.name || '--- لم يحدد ---'}</td>
                          <td className="p-2 border-l border-slate-300 text-center font-bold">{mat.qty}</td>
                          <td className="p-2 border-l border-slate-300 text-center font-bold dir-ltr">{formatCurrency(mat.price)}</td>
                          <td className="p-2 text-center font-bold dir-ltr text-blue-800 bg-slate-50">{formatCurrency((mat.qty || 0) * (mat.price || 0))}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="5" className="p-2 border-t border-l border-slate-400 font-bold text-left bg-slate-100 text-slate-700">إجمالي القسم:</td>
                        <td className="p-2 border-t border-slate-400 font-black text-center dir-ltr text-slate-900 bg-slate-200">{formatCurrency(printData.data.materials.filter(m => !m.worksOf && (Number(m.price) > 0 || Number(m.qty) > 0)).reduce((sum, mat) => sum + ((mat.qty || 0) * (mat.price || 0)), 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-8 flex justify-end break-inside-avoid">
                 <div className="bg-slate-100 p-4 border border-slate-300 rounded-lg w-1/2 shadow-sm">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-700">التكلفة الإجمالية:</span>
                     <span className="font-black text-xl text-red-600 dir-ltr">{formatCurrency(printData.data.totalCost)}</span>
                   </div>
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-700">سعر البيع المقترح:</span>
                     <span className="font-black text-xl text-blue-600 dir-ltr">{formatCurrency(printData.data.sellPrice)}</span>
                   </div>
                 </div>
              </div>
            </PrintPageWrapper>
            {printData.data.attachments && printData.data.attachments.filter(att => att.type.startsWith('image/')).map((att, attIdx) => (
              <PrintPageWrapper key={`est-att-${attIdx}`} id={`est-att-${attIdx}`} title={`مرفق تقدير`} className="print:break-before-page w-full h-[95vh] print:h-[95vh] flex flex-col items-center justify-center p-8">
                <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 w-full border-b pb-4">مرفق التقدير: {printData.data.desc}</h2>
                <img src={att.data} alt={att.name} className="max-w-full max-h-full object-contain" style={{ maxHeight: '85vh' }} />
              </PrintPageWrapper>
            ))}
          </>
        )}
        </div>
      </div>
      </ErrorBoundary>
    );
  }


  // Auth gate — placed here AFTER all hooks so React rules are not violated
  if (!currentUser) return <LoginView />;

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 font-sans flex print:hidden`} dir="rtl">
      {migrationToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-3 w-11/12 md:w-auto">
          <Database className="w-5 h-5 flex-shrink-0" />
          <div className="font-bold text-sm md:text-base">تم ترحيل البيانات بنجاح إلى قاعدة بيانات SQLite!</div>
          <button onClick={() => setMigrationToast(false)} className="mr-auto hover:bg-emerald-700 p-1 rounded-full"><X className="w-4 h-4"/></button>
        </div>
      )}
      {!isElectron() && serverOnline === false && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 px-4 text-xs md:text-sm font-bold z-50 flex flex-wrap items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          تعذّر الاتصال بالخادم ({API_BASE_URL}). تحقق من الشبكة أو البرنامج على الجهاز الرئيسي.
          <button onClick={() => checkServerHealth().then(ok => setServerOnline(ok))} className="mr-2 underline">إعادة المحاولة</button>
        </div>
      )}
      {!isElectron() && serverOnline === true && (
        <div className="fixed bottom-4 left-4 bg-emerald-700/90 text-white text-xs px-3 py-1.5 rounded-full z-40 flex items-center gap-1.5 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse inline-block"/>
          متصل بالخادم
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white z-30 flex items-center justify-between px-4 shadow-lg">
        <h1 className="text-lg font-black flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-blue-500" /> شمس للمقطورات</h1>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-800 rounded-lg text-white">
          <List className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-50 fixed h-full top-0 right-0 transform transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 bg-slate-950/50 flex justify-between items-center">
          <h1 className="text-xl font-black text-white flex items-center gap-3"><LayoutDashboard className="w-6 h-6 text-blue-500" /> شمس</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
            { id: 'estimates', icon: FileText, label: 'التقديرات والعروض' },
            { id: 'workOrders', icon: Factory, label: 'أوامر التصنيع' },
            { id: 'invoices', icon: Archive, label: 'سجل الصادر' },
            { id: 'customers', icon: Users, label: 'العملاء' },
            { id: 'drivers', icon: Truck, label: 'السائقون' },
            { id: 'materials', icon: Package, label: 'إدارة المواد' },
            { id: 'worksOf', icon: Settings, label: 'أنواع الأعمال' },
            { id: 'estimateCategories', icon: Tags, label: 'تصنيف التقديرات' },
            { id: 'settings', icon: Settings, label: 'الإعدادات العامة' },
            { id: 'users', icon: UserCog, label: 'إدارة المستخدمين' },
          ].filter(item => hasPermission(item.id, 'view'))
           .map(item => {
             const badgeCount = getNewCount(item.id);
             return (
               <button key={item.id} onClick={() => { setActiveTab(item.id); setViewState('list'); setIsSidebarOpen(false); window.scrollTo(0, 0); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}>
                 <div className="flex items-center gap-3">
                   <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-slate-400'}`} /> {item.label}
                 </div>
                 {badgeCount > 0 && (
                   <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center animate-in zoom-in">
                     {badgeCount}
                   </span>
                 )}
               </button>
             );
          })}
        </nav>
        {/* User info & logout */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              {currentUser.displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate">{currentUser.displayName}</div>
              <div className="text-slate-400 text-xs truncate">{currentUser.role === 'admin' ? '🛡 مدير' : 'مستخدم'}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 md:mr-64 min-h-screen pt-20 md:pt-8 w-full ">
        <div className="w-full xl:max-w-[1400px] 2xl:max-w-[1800px] mx-auto">
          {!isPermitted ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-red-50 p-6 rounded-full mb-6">
                <ShieldOff className="w-16 h-16 text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-3">عذراً، غير مصرح بالدخول</h2>
              <p className="text-slate-500 text-lg max-w-md">ليس لديك الصلاحيات الكافية لعرض هذه الصفحة. تواصل مع مدير النظام لتعديل صلاحياتك.</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}
              {activeTab === 'estimates' && viewState !== 'calculator' && <EstimatesView setViewState={setViewState} setActiveTab={setActiveTab} setTabStates={setTabStates} setEditingInvoice={setEditingInvoice} />}
              {(activeTab === 'estimates' || activeTab === 'workOrders') && viewState === 'calculator' && <CostCalculatorView setViewState={setViewState} />}
              {activeTab === 'workOrders' && viewState !== 'calculator' && <WorkOrdersView setViewState={setViewState} setEditingInvoice={setEditingInvoice} setActiveTab={setActiveTab} setTabStates={setTabStates} />}
              {activeTab === 'invoices' && viewState !== 'edit_invoice' && <OutboundLogView setEditingInvoice={setEditingInvoice} setActiveTab={setActiveTab} setViewState={setViewState} />}
              {activeTab === 'invoices' && viewState === 'edit_invoice' && editingInvoice && <InvoiceEditorView editingInvoice={editingInvoice} setEditingInvoice={setEditingInvoice} setViewState={setViewState} />}
              {activeTab === 'customers' && <CustomersView />}
              {activeTab === 'drivers' && <DriversView />}
              {activeTab === 'materials' && <MaterialsView />}
              {activeTab === 'worksOf' && <WorksOfView selectedWorkId={selectedWorkId} setSelectedWorkId={setSelectedWorkId} />}
              {activeTab === 'estimateCategories' && <EstimateCategoriesView />}
              {activeTab === 'settings' && <SettingsView />}
              {activeTab === 'users' && <UsersView />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

