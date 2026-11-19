import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import shamsLogo from './assets/shamsLogo.png';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Trash2, Edit, Package, Users,
  FileText, ShoppingCart, Settings, Printer, Download,
  X, Factory, LayoutDashboard, Check, Save, Copy, FileEdit, FileCheck2, Eye, EyeOff, Archive, ArrowUp, ArrowDown, ChevronUp, ChevronDown, ChevronsUpDown, List, Grid, Truck, MapPin, RefreshCw, Database, Mail, FilterX, Tags,
  Building2, ShoppingBag, Layers, Loader2, Sliders, Share2, ZoomIn, ZoomOut
} from 'lucide-react';

import { formatCurrency, numberToArabicWords } from './utils/formatters';

import { PortalDropdown } from './components/ui/PortalDropdown';
import { SubTabNav } from './components/ui/SubTabNav';

class ErrorBoundary extends React.Component<{ children: React.ReactNode; title?: string }, { hasError: boolean; error: any; errorInfo: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl max-w-4xl mx-auto my-8 text-right" dir="rtl">
          <h1 className="text-2xl mb-2 text-red-800">{this.props.title || 'حدث خطأ أثناء عرض المحتوى'}</h1>
          <p className="mb-4 text-slate-700 text-sm">واجه التطبيق مشكلة أثناء عرض هذا الجزء.</p>
          <p className="mb-4 text-slate-800 font-mono text-xs bg-white p-3 rounded border border-red-200 text-left" dir="ltr">
            {this.state.error && this.state.error.toString()}
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-bold">
              إعادة المحاولة
            </button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold">
              تحديث التطبيق
            </button>
          </div>
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
import { SuppliersView } from './views/Suppliers/SuppliersView';
import { useSuppliers } from './context/SuppliersContext';
import { PurchasesView } from './views/Purchases/PurchasesView';
import { usePurchases } from './context/PurchasesContext';
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
import { AuditLogView } from './views/Audit/AuditLogView';
import { HRView } from './views/HR/HRView';
import { ReportsView } from './views/Reports/ReportsView';
import { logAudit, useAuditLog } from './context/AuditLogContext';
import { UserCog, LogOut, ShieldOff, ShieldCheck, UserCheck, BarChart3 } from 'lucide-react';



export default function App() {
  const { currentUser, logout, hasPermission, users } = useAuth();
  const { logs } = useAuditLog();
  const [printStats, setPrintStats] = useDatabaseObject<Record<string, { count: number; lastPrintedAt?: string; lastPrintedBy?: string }>>('shams_print_stats', {});
  const [activeTab, setActiveTab] = useLocalStorage('shams_activeTab', 'dashboard');
  const [hrRefreshKey, setHrRefreshKey] = useState(0);
  const [tabStates, setTabStates] = useState({});
  const viewState = tabStates[activeTab] || 'list';
  const setViewState = (state, targetTab) => setTabStates(prev => ({ ...prev, [targetTab || activeTab]: state }));
  const { printData, setPrintData } = usePrint();
  const [excludedPages, setExcludedPages] = useState([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPrintScaleSettings, setShowPrintScaleSettings] = useState(false);
  const [mobileFitWidth, setMobileFitWidth] = useState(true);

  // كشف بيئة التشغيل
  const isElectronEnv = !!(window as any).electronAPI;
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


  const isTabPermitted = (tab: string) => {
    if (tab === 'purchases') return hasPermission('purchases', 'view') || hasPermission('suppliers', 'view');
    if (tab === 'customers') return hasPermission('customers', 'view') || hasPermission('drivers', 'view');
    if (tab === 'estimates') return hasPermission('estimates', 'view') || hasPermission('estimateCategories', 'view');
    if (tab === 'materials') return hasPermission('materials', 'view') || hasPermission('worksOf', 'view');
    return hasPermission(tab, 'view');
  };

  const isPermitted = isTabPermitted(activeTab);

  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape' && printData) setPrintData(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [printData]);

  // Log print activities across the system
  useEffect(() => {
    if (printData && printData.type) {
      const type = printData.type;
      const data = printData.data;
      let entityType = 'مستند';
      let entityId = '';
      let title = 'طباعة مستند';
      let details = '';

      if (type === 'INVOICE') {
        entityType = 'فواتير المبيعات';
        entityId = data?.id || '';
        title = `طباعة فاتورة: ${data?.id || ''}`;
        details = `العميل: ${data?.customerName || '--'} | الإجمالي: ${data?.totalAmount || '--'} د.ل`;
      } else if (type === 'WORK_ORDER') {
        entityType = 'أوامر التصنيع';
        entityId = data?.id || '';
        title = `طباعة أمر تصنيع: ${data?.id || ''}`;
        details = `عدد البنود: ${data?.items?.length || 0} ${printData.excludeAttachments ? '(بدون صور)' : '(مع الصور)'}`;
      } else if (type === 'SHIPPING_ORDER') {
        entityType = 'أوامر النقل';
        entityId = data?.id || '';
        title = `طباعة أمر نقل: ${data?.id || ''}`;
        details = `السائق: ${data?.driverName || '--'} | الوجهة: ${data?.destination || '--'}`;
      } else if (type === 'LETTER') {
        entityType = 'المراسلات';
        entityId = data?.id || '';
        title = `طباعة رسالة: ${data?.id || ''}`;
        details = `الموضوع: ${data?.subject || '--'} | الجهة: ${data?.to || '--'}`;
      } else if (type === 'ESTIMATE') {
        entityType = 'التقديرات';
        entityId = String(data?.id || '');
        title = `طباعة عرض سعر: ${data?.desc || data?.id || ''}`;
        details = `سعر البيع: ${data?.sellPrice || '--'} د.ل`;
      } else if (type === 'PURCHASE_INVOICE') {
        entityType = 'المشتريات';
        entityId = data?.invoiceNumber || data?.id || '';
        title = `طباعة فاتورة مشتريات: ${data?.invoiceNumber || ''}`;
        details = `المورد: ${data?.supplierName || '--'} | القيمة: ${data?.totalAmount || '--'} د.ل`;
      }

      logAudit({
        actionType: 'print',
        entityType,
        entityId: String(entityId),
        title,
        details
      });

      const docId = entityId || data?.id;
      if (docId) {
        setPrintStats(prev => {
          const pastCount = (logs || []).filter(l => l.actionType === 'print' && l.entityId === String(docId)).length;
          const currentCount = (prev?.[docId]?.count || pastCount || 0) + 1;
          return {
            ...prev,
            [docId]: {
              count: currentCount,
              lastPrintedAt: new Date().toISOString(),
              lastPrintedBy: currentUser?.displayName || currentUser?.username || 'المستخدم'
            }
          };
        });
      }
    }
  }, [printData]);
  
  const [migrationToast, setMigrationToast] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Migration notification (first run after JSON → SQLite migration)
    getMigrationStatus().then(status => {
      if (status) {
        setMigrationToast(true);
        setTimeout(() => setMigrationToast(false), 10000);
      }
    });

    const handleConnStatus = (e: any) => {
      if (typeof e.detail?.online === 'boolean') {
        setServerOnline(e.detail.online);
      }
    };

    const handleSyncFailed = (e: any) => {
      setSyncErrorMessage(e.detail?.error || 'فشل مزامنة البيانات مع الخادم الرئيسي وتم التراجع عن العملية محلياً.');
      setTimeout(() => setSyncErrorMessage(null), 7000);
    };

    window.addEventListener('shams-connection-status', handleConnStatus);
    window.addEventListener('shams-sync-failed', handleSyncFailed);

    let intervalId: any;
    let cleanupSync: (() => void) | undefined;

    // For browser clients: check server connectivity once on mount and every 5 seconds
    if (!isElectron()) {
      checkServerHealth().then(online => setServerOnline(online));
      intervalId = setInterval(async () => {
        const online = await checkServerHealth();
        setServerOnline(online);
      }, 5000);
      cleanupSync = setupRealtimeSync();
    } else {
      setServerOnline(true); // Electron is always local
      cleanupSync = setupRealtimeSync();
    }

    return () => {
      window.removeEventListener('shams-connection-status', handleConnStatus);
      window.removeEventListener('shams-sync-failed', handleSyncFailed);
      if (intervalId) clearInterval(intervalId);
      if (cleanupSync) cleanupSync();
    };
  }, []);

  const [selectedWorkId, setSelectedWorkId] = useState(null);

  const { appSettings, setAppSettings, idCountersRef: idCounters, generateId } = useSettings();
  const { customers, setCustomers } = useCustomers();
  const { drivers, setDrivers } = useDrivers();
  const { suppliers } = useSuppliers();
  const [shippingOrders, setShippingOrders] = useDatabaseObject('shams_shippingOrders', []);
  const { masterMaterials, setMasterMaterials, worksOf, setWorksOf, masterItems, setMasterItems } = useMaterials();
  const { estimates, setEstimates, estimateCategories, setEstimateCategories, cart, setCart, editingEstimate, setEditingEstimate, editingContext, setEditingContext, calculatorDraftRef } = useEstimates();
  const { workOrders, setWorkOrders } = useWorkOrders();
  const { invoices, setInvoices, deletedInvoices, setDeletedInvoices } = useInvoices();
  const { purchaseInvoices } = usePurchases();
  const [letters, setLetters] = useDatabaseObject('shams_letters', []);
  const [savedNotes, setSavedNotes] = useDatabaseObject('shams_savedNotes', []);
  const [savedTerms, setSavedTerms] = useDatabaseObject('shams_savedTerms', []);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // ── Sub-tab states for unified pages ─────────────────────────────────────────
  const [purchasesSubTab, setPurchasesSubTab] = useLocalStorage<'invoices' | 'suppliers'>('shams_purchases_subtab', 'invoices');
  const [customersSubTab, setCustomersSubTab] = useLocalStorage<'customers' | 'drivers'>('shams_customers_subtab', 'customers');
  const [estimatesSubTab, setEstimatesSubTab] = useLocalStorage<'estimates' | 'categories'>('shams_estimates_subtab', 'estimates');
  const [materialsSubTab, setMaterialsSubTab] = useLocalStorage<'materials' | 'worksOf'>('shams_materials_subtab', 'materials');

  // Backward-compatibility redirect for legacy stored tabs
  useEffect(() => {
    if (activeTab === 'suppliers') {
      setActiveTab('purchases');
      setPurchasesSubTab('suppliers');
    } else if (activeTab === 'drivers') {
      setActiveTab('customers');
      setCustomersSubTab('drivers');
    } else if (activeTab === 'estimateCategories') {
      setActiveTab('estimates');
      setEstimatesSubTab('categories');
    } else if (activeTab === 'worksOf') {
      setActiveTab('materials');
      setMaterialsSubTab('worksOf');
    }
  }, [activeTab]);

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
  }, [activeTab, estimates, workOrders, invoices, letters, shippingOrders, purchaseInvoices]);

  const getNewCount = (tabId) => {
    if (activeTab === tabId) return 0;
    const timestamp = lastSeen[tabId] || 0;
    const isNew = (item) => new Date(item.date || item.lastUpdated || 0).getTime() > timestamp;
    
    if (tabId === 'estimates') return (estimates || []).filter(isNew).length;
    if (tabId === 'workOrders') return (workOrders || []).filter(isNew).length;
    if (tabId === 'purchases') return (purchaseInvoices || []).filter(isNew).length;
    if (tabId === 'invoices') return (invoices || []).filter(isNew).length + (letters || []).filter(isNew).length + (shippingOrders || []).filter(isNew).length;
    return 0;
  };


  const formatDateYMD = (dVal: any): string => {
    if (!dVal) return '';
    const d = new Date(dVal);
    if (isNaN(d.getTime())) return String(dVal);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  };

  const getCleanDocFileName = (pData: any, forShare: boolean = false): string => {
    if (!pData) return 'Document.pdf';
    const data = pData.data;
    let raw = data?.id;

    if (!raw) {
      if (pData.type === 'WORK_ORDER' && data?.items?.[0]) {
        raw = data.items[0].serialNumber ? `WO-${data.items[0].serialNumber}` : `WO-${data.date || 'order'}`;
      } else if (pData.type === 'SHIPPING_ORDER') {
        raw = data?.refNumber || data?.id || 'Shipping-Order';
      } else if (pData.type === 'ESTIMATE') {
        raw = data?.id || 'Estimate';
      } else if (pData.type?.startsWith('HR_')) {
        raw = `${pData.type}-${data?.month || data?.date || data?.employee?.name || 'report'}`;
      } else {
        raw = 'Document';
      }
    }

    // تنظيف الاسم من الرموز الممنوعة
    let clean = String(raw).replace(/[\/\\:*?"<>|\r\n\t]/g, '-').trim();
    clean = clean.replace(/\s+/g, '_').replace(/-+/g, '-').replace(/_+/g, '_');

    // إذا كان للمشاركة عبر الهاتف (واتساب)، فإن أنظمة أندرويد تحول الحروف العربية إلى رموز مشوهة %D8...
    // لذلك نستخرج الرقم الإشاري الصريح النظيف (مثل Ref-434-2026.pdf) ليظهر أنيقاً ومنضبطاً
    if (forShare) {
      const refMatch = clean.match(/^(Ref-\d+)(?:.*?(\d{4}))?/i);
      if (refMatch) {
        clean = refMatch[2] ? `${refMatch[1]}-${refMatch[2]}` : refMatch[1];
      } else {
        const asciiClean = clean.replace(/[^\x20-\x7E]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '');
        if (asciiClean && asciiClean.length > 2) {
          clean = asciiClean;
        }
      }
    }

    if (!clean.toLowerCase().endsWith('.pdf')) {
      clean += '.pdf';
    }
    return clean;
  };

  const handleSavePDF = async () => {
    const electronAPI = (window as any).electronAPI;
    const title = getCleanDocFileName(printData);
    if (electronAPI && electronAPI.printToPDF) {
      const success = await electronAPI.printToPDF(title);
      if (success) setPrintData(null);
    } else {
      const originalTitle = document.title;
      document.title = title.replace(/\.pdf$/i, '');
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 4000);
    }
  };

  // تصدير PDF مباشر مع دعم محرك Chromium الأصلي لتشبيك الحروف العربية بدقة 100%
  const handleExportPDFBrowser = async (asShare: boolean = false) => {
    const printArea = document.getElementById('print-content-area');
    if (!printArea) {
      alert('تعذّر العثور على منطقة المحتوى. حاول مجدداً.');
      return;
    }

    const fileName = getCleanDocFileName(printData, asShare);

    try {
      setIsExportingPDF(true);

      // جمع كل صفحات الطباعة غير المستبعدة
      const printPages = Array.from(printArea.querySelectorAll<HTMLElement>('.print-page'));
      const visiblePages = printPages.filter(page => {
        const pageId = page.getAttribute('data-page-id') || '';
        return !excludedPages.includes(pageId);
      });

      const pagesToCapture = visiblePages.length > 0 ? visiblePages : [printArea];
      const visibleHtml = pagesToCapture.map(p => p.outerHTML).join('\n');
      // استخراج كافة قواعد CSS المترجمة والمحملة في المتصفح لضمان ظهور التنسيق بالكامل في PDF
      const collectAllStyles = (): string => {
        let cssBlocks: string[] = [];

        // 1. قراءة قواعد الـ stylesheets المحملة في الذاكرة (قواعد Tailwind v4 بالكامل)
        try {
          for (let i = 0; i < document.styleSheets.length; i++) {
            const sheet = document.styleSheets[i];
            try {
              const rules = sheet.cssRules || (sheet as any).rules;
              if (rules) {
                let sheetCss = '';
                for (let j = 0; j < rules.length; j++) {
                  sheetCss += rules[j].cssText + '\n';
                }
                if (sheetCss) cssBlocks.push(sheetCss);
              }
            } catch (sheetErr) {
              if (sheet.href) {
                cssBlocks.push(`@import url("${sheet.href}");`);
              }
            }
          }
        } catch (e) {
          console.warn('Could not read styleSheets rules:', e);
        }

        // 2. قراءة كل وسوم <style> المباشرة في الصفحة
        const inlineStyles = Array.from(document.querySelectorAll('style'))
          .map(s => s.innerHTML)
          .join('\n');
        if (inlineStyles) cssBlocks.push(inlineStyles);

        return `<style>\n${cssBlocks.join('\n')}\n</style>`;
      };

      const styles = collectAllStyles();

      let pdfBlob: Blob | null = null;

      // 1. الخيار الأول (الأعلى جودة): إرسال المستند لخادم Chromium لإنشاء PDF نقي فيكتور مع ربط الحروف العربية
      try {
        const res = await fetch(`${API_BASE_URL}/api/render-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: visibleHtml,
            styles,
            printScale: appSettings.printScale || 90,
            fileName
          })
        });

        if (res.ok) {
          pdfBlob = await res.blob();
        }
      } catch (serverErr) {
        console.warn('Server PDF render unavailable, using client fallback:', serverErr);
      }

      // 2. الخيار الثاني (Fallback محلي): في حال تعذر الاتصال بالسيرفر
      if (!pdfBlob) {
        const [{ default: html2canvas }, jspdfModule] = await Promise.all([
          import('html2canvas-pro'),
          import('jspdf'),
        ]);

        const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default;
        if (!jsPDF) throw new Error('تعذر تحميل مشغل jsPDF');

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // حاوية مؤقتة معزولة ونظيفة لالتقاط الصفحة بدقة A4 باتجاه اليمين لليسار RTL
        const stagingDiv = document.createElement('div');
        stagingDiv.id = 'pdf-render-staging';
        stagingDiv.dir = 'rtl';
        stagingDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#ffffff;z-index:-9999;overflow:visible;direction:rtl;text-align:right;';
        document.body.appendChild(stagingDiv);

        try {
          for (let i = 0; i < pagesToCapture.length; i++) {
            const page = pagesToCapture[i];
            const clone = page.cloneNode(true) as HTMLElement;
            clone.dir = 'rtl';
            clone.style.margin = '0';
            clone.style.boxShadow = 'none';
            clone.style.border = 'none';
            clone.style.width = '794px';
            clone.style.minWidth = '794px';
            clone.style.maxWidth = '794px';
            clone.style.background = '#ffffff';
            clone.style.direction = 'rtl';
            clone.style.textAlign = 'right';
            stagingDiv.innerHTML = '';
            stagingDiv.appendChild(clone);

            await new Promise(r => setTimeout(r, 60));

            const canvas = await html2canvas(clone, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false,
              width: 794,
              windowWidth: 1200,
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgAspect = canvas.height / canvas.width;
            const imgHeightMM = pdfWidth * imgAspect;

            if (i > 0) pdf.addPage();

            if (imgHeightMM <= pdfHeight) {
              pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeightMM);
            } else if (imgHeightMM <= pdfHeight * 1.15) {
              // إذا كان الارتفاع يزيد بنسبة بسيطة (أقل من 15%)، نقوم بملاءمة الصفحة كاملة بدلاً من قص التوقيع في صفحة جديدة
              const scale = pdfHeight / imgHeightMM;
              const scaledWidth = pdfWidth * scale;
              const xOffset = (pdfWidth - scaledWidth) / 2;
              pdf.addImage(imgData, 'JPEG', xOffset, 0, scaledWidth, pdfHeight);
            } else {
              const pxPerMM = canvas.width / pdfWidth;
              let yPx = 0;
              let pageNum = i;
              while (yPx < canvas.height) {
                const sliceHeightPx = Math.min(pdfHeight * pxPerMM, canvas.height - yPx);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceHeightPx;
                const ctx = sliceCanvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(canvas, 0, yPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
                  const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
                  if (pageNum > i) pdf.addPage();
                  pdf.addImage(sliceData, 'JPEG', 0, 0, pdfWidth, (sliceHeightPx / pxPerMM));
                }
                yPx += sliceHeightPx;
                pageNum++;
              }
            }
          }
          pdfBlob = pdf.output('blob');
        } finally {
          if (stagingDiv.parentNode) {
            document.body.removeChild(stagingDiv);
          }
        }
      }

      if (!pdfBlob) {
        throw new Error('فشل إنشاء ملف PDF');
      }

      // خيار المشاركة المباشرة عبر تطبيقات الهاتف (واتساب / إيميل / تيليجرام / حفظ في الملفات)
      if (asShare && typeof navigator !== 'undefined' && navigator.canShare) {
        try {
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            const docDesc = printData.data?.subject || printData.data?.customerName || printData.data?.id || '';
            await navigator.share({
              files: [file],
              title: docDesc || fileName,
              text: docDesc ? `مستند: ${docDesc}` : `مستند رقم ${fileName}`
            });
            setPrintData(null);
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            return;
          }
          console.warn('Share failed, fallback to save:', shareErr);
        }
      }

      // التنزيل المباشر كملف
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setPrintData(null);
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert(`حدث خطأ أثناء تصدير PDF: ${err?.message || err}`);
    } finally {
      setIsExportingPDF(false);
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
      const originalTitle = document.title;
      if (printData.data && printData.data.id) document.title = printData.data.id;
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 4000);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState('');

  useEffect(() => {
    // إغلاق المعاينة بعد الطباعة فقط على الكمبيوتر؛ على الهواتف يترك للمستخدم زر الإلغاء لمنع إغلاق الطباعة قبل فتحها
    if (!isMobileDevice) {
      const afterPrint = () => setPrintData(null);
      window.addEventListener('afterprint', afterPrint);
      return () => window.removeEventListener('afterprint', afterPrint);
    }
  }, [isMobileDevice]);

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
      if (printData && printData.excludeAttachments) {
        const exclude: string[] = [];
        if (printData.type === 'WORK_ORDER' && printData.data?.items) {
          printData.data.items.forEach((item: any) => {
            if (item.attachments) {
              item.attachments.forEach((_: any, attIdx: number) => {
                exclude.push(`wo-att-${item.serialNumber}-${attIdx}`);
              });
            }
          });
        }
        if (printData.data?.attachments) {
          printData.data.attachments.forEach((_: any, attIdx: number) => {
            exclude.push(`shp-att-${attIdx}`);
            exclude.push(`est-att-${attIdx}`);
            exclude.push(`purch-att-${attIdx}`);
            exclude.push(`wo-att-${attIdx}`);
          });
        }
        setExcludedPages(exclude);
      } else {
        setExcludedPages([]);
      }
    }
  }, [printData]);

  const PrintPageWrapper = ({ id, title, className, children }) => {
    const isExcluded = excludedPages.includes(id);
    return (
      <div data-page-id={id} dir="rtl" className={`print-page relative p-8 sm:p-10 ${className || ''} ${isExcluded ? 'opacity-30 grayscale print:hidden' : ''}`} style={{ direction: 'rtl', textAlign: 'right' }}>
        <div className={isExcluded ? 'pointer-events-none' : ''}>
           {children}
        </div>
      </div>
    );
  };

  if (printData) {
    const PrintCompanyHeader = ({ showBorder = true, className = '' }: { showBorder?: boolean; className?: string }) => {
      const isHR = printData?.type?.startsWith('HR_');
      return (
        <div className={`flex justify-between items-center ${showBorder ? 'border-b-2 border-slate-800 pb-6 mb-6 mt-4' : 'mb-6'} ${className}`}>
          <div className="flex-1 text-right">
            <h2 className="text-2xl font-black text-slate-800 mb-2 leading-snug whitespace-pre-wrap">{appSettings.companyNameAr}</h2>
            {!isHR && (
              <div className="text-slate-600 font-semibold space-y-1 text-sm mt-3">
                {appSettings.address && <div>{appSettings.address}</div>}
                {appSettings.cr && <div>{appSettings.cr}</div>}
                {appSettings.phones && <div dir="ltr" className="text-right">{appSettings.phones}</div>}
              </div>
            )}
          </div>
          <div className="mx-8 flex-shrink-0">
            <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-28 w-auto object-contain" style={{ maxHeight: '7rem', maxWidth: '16rem', objectFit: 'contain' }} />
          </div>
          <div className="flex-1 text-left" dir="ltr">
            <h2 className="text-xl font-black text-slate-800 mb-2 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
            {!isHR && (
              <div className="text-slate-600 font-semibold space-y-1 text-sm mt-3">
                {appSettings.email && <div>{appSettings.email}</div>}
                {appSettings.website && <div>{appSettings.website}</div>}
              </div>
            )}
          </div>
        </div>
      );
    };

    const PrintInvoiceHeader = ({ docId, date, customer, type }) => (
      <div className="border-b-2 border-slate-800 pb-6 mb-8 mt-4">
        <PrintCompanyHeader showBorder={false} />

        <div className="flex justify-between items-end bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">
              {type === 'إنتاجية' ? 'فاتورة مستحقات إنتاجية (أعمال فنيين)' : `فاتورة ${type}`}
            </h1>
            <div className="text-lg text-slate-700">رقم المستند: <span className="font-mono font-bold text-slate-900">{docId}</span></div>
            <div className="text-lg text-slate-700">التاريخ: <span className="font-semibold text-slate-900">{new Date(date).toLocaleDateString('ar-LY')}</span></div>
          </div>
          {customer && (
            <div className="text-left">
              <div className="text-lg text-slate-700 mb-1">
                {type === 'إنتاجية' ? 'السيد الفني / ' : 'السادة / '}
                <span className="font-bold text-xl text-slate-900">{customer}</span>
                {type === 'إنتاجية' ? ' المحترم' : ' المحترمين'}
              </div>
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
          <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-24 w-auto object-contain" style={{ maxHeight: '6rem', maxWidth: '16rem', objectFit: 'contain' }} />
        </div>
        <div className="flex-1 text-left" dir="ltr">
          <h2 className="text-xl font-black text-slate-800 leading-snug whitespace-pre-wrap">{appSettings.companyNameEn}</h2>
        </div>
      </div>
    );

    const groupedPrintItems = printData.type.includes('INVOICE') ? Object.values(printData.data.items.reduce((acc, item) => {
      const key = printData.data.type === 'إنتاجية'
        ? `tech_${item.serialNumber || ''}_${item.desc}_${item.specialty || ''}_${item.sellPrice}`
        : `${item.desc}_${item.notes || ''}_${item.chassis}_${item.length}_${item.width}_${item.height}_${item.sellPrice}`;
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
          item.attachments.filter((att: any) => att.type?.startsWith('image/') || att.data).forEach((att: any, attIdx: number) => {
            availablePages.push({ id: `wo-att-${item.serialNumber}-${attIdx}`, title: `مرفق صورة (${attIdx + 1}) - ${item.desc}` });
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
    } else if (printData.type === 'SHIPPING_ORDER') {
      availablePages.push({ id: 'shipping-order-driver', title: 'أمر نقل - نسخة السائق' });
      availablePages.push({ id: 'shipping-order-customer', title: 'إيصال استلام - نسخة الزبون' });
      if (printData.data.attachments) {
        printData.data.attachments.filter((att: any) => att.type?.startsWith('image/') || att.data).forEach((att: any, attIdx: number) => {
          availablePages.push({ id: `shp-att-${attIdx}`, title: `مرفق صورة (${attIdx + 1})` });
        });
      }
    } else if (printData.type === 'HR_PAYROLL') {
      availablePages.push({ id: 'hr-payroll-sheet', title: `مسير رواتب: ${printData.data.month || ''}` });
    } else if (printData.type === 'HR_TIMECARD') {
      availablePages.push({ id: 'hr-timecard-sheet', title: `بطاقة حضور: ${printData.data.employee?.name || ''}` });
    } else if (printData.type === 'HR_PAYSLIPS') {
      (printData.data.slips || []).forEach((slip: any, idx: number) => {
        availablePages.push({ id: `hr-payslip-${slip.employee?.id || idx}`, title: `قسيمة راتب: ${slip.employee?.name || slip.item?.employeeName || idx + 1}` });
      });
    } else if (printData.type === 'HR_SETTLEMENT') {
      availablePages.push({ id: 'hr-settlement-sheet', title: `مخالصة نهائية: ${printData.data.settlement?.employeeName || ''}` });
    } else if (printData.type === 'HR_OVERTIME_DAILY') {
      availablePages.push({ id: 'hr-overtime-sheet', title: `كشف العمل الإضافي: ${printData.data.date || ''}` });
    }

    return (
      <ErrorBoundary>
      <div className="bg-slate-800 min-h-screen text-black font-sans flex flex-col print:bg-white print:min-h-0 print:h-auto" dir="rtl">
        {/* شريط الأدوات العلوي — مثبت بالأعلى ضمن تسلسل الصفحة لمنع حجب المستند نهائياً */}
        <div className="print:hidden sticky top-0 left-0 w-full bg-slate-900 text-white p-3 sm:p-4 shadow-xl flex flex-col gap-3 z-50 shrink-0 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <div className="font-bold flex items-center gap-2"><Printer className="w-5 h-5 text-blue-400" /> معاينة الطباعة للنسخة الورقية</div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button onClick={() => setPrintData(null)} className="bg-slate-700 hover:bg-slate-600 px-4 md:px-5 py-2 rounded-lg font-bold transition-colors text-sm md:text-base">إلغاء والرجوع</button>

              {/* زر إعدادات تنسيق ومقياس المطبوعات */}
              <button
                type="button"
                onClick={() => setShowPrintScaleSettings(prev => !prev)}
                className={`px-3 md:px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-sm md:text-base ${
                  showPrintScaleSettings
                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                }`}
                title="تعديل مقياس وحجم خط المطبوعات"
              >
                <Sliders className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
                <span>تنسيق المطبوعات <span className="font-mono text-xs bg-slate-900/80 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">{appSettings.printScale || 90}%</span></span>
              </button>

              {/* زر PDF — يعمل على كل البيئات بما فيها الهاتف */}
              <button
                onClick={isElectronEnv ? handleSavePDF : () => handleExportPDFBrowser(false)}
                disabled={isExportingPDF}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 md:px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm md:text-base shadow-sm"
              >
                {isExportingPDF ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Download className="w-4 h-4 md:w-5 md:h-5" />}
                {isExportingPDF ? 'جاري التصدير...' : 'حفظ كـ PDF'}
              </button>

              {/* زر مشاركة PDF (لإرساله مباشرة عبر واتساب / التطبيقات في الهاتف) */}
              {!isElectronEnv && (
                <button
                  onClick={() => handleExportPDFBrowser(true)}
                  disabled={isExportingPDF}
                  className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 md:px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm md:text-base shadow-sm"
                  title="مشاركة أو إرسال الملف مباشرة عبر واتساب أو التطبيقات"
                >
                  <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                  <span>مشاركة</span>
                </button>
              )}

              {/* زر ملاءمة العرض للهاتف */}
              {isMobileDevice && (
                <button
                  type="button"
                  onClick={() => setMobileFitWidth(!mobileFitWidth)}
                  className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors text-xs sm:text-sm shadow-sm ${
                    mobileFitWidth
                      ? 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40'
                  }`}
                  title={mobileFitWidth ? 'عرض بالحجم الكامل 100%' : 'ملاءمة الصفحة لعرض شاشة الهاتف'}
                >
                  {mobileFitWidth ? <ZoomIn className="w-4 h-4" /> : <ZoomOut className="w-4 h-4" />}
                  <span>{mobileFitWidth ? 'تكبير 100%' : 'ملاءمة الشاشة'}</span>
                </button>
              )}

              {/* زر الطباعة — لأجهزة الكمبيوتر */}
              {!isMobileDevice && (
                <button
                  onClick={isElectronEnv ? handlePrintDirect : () => { const d = printData.data?.id; const o = document.title; if(d) document.title = d; window.print(); setTimeout(() => { document.title = o; }, 4000); }}
                  className="bg-blue-600 hover:bg-blue-500 px-4 md:px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm md:text-base shadow-sm"
                >
                  <Printer className="w-4 h-4 md:w-5 md:h-5" /> طباعة
                </button>
              )}
            </div>
          </div>

          {/* لوحة إعدادات تنسيق المطبوعات المنسدلة */}
          {showPrintScaleSettings && (
            <div className="bg-slate-800/95 border border-amber-500/40 p-3.5 rounded-xl text-white shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-700/80">
                <div className="font-bold text-sm text-amber-300 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>إعدادات تنسيق المطبوعات والخطوط (Print Layout & Scale)</span>
                </div>
                <div className="text-xs text-slate-400">
                  اضبط مقياس الصفحة ليناسب عدد البنود مع صندوق الاعتماد في صفحة واحدة دون انقسام.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { scale: 80, label: '80%', desc: 'مدمج جداً (14-16 بند)' },
                  { scale: 85, label: '85%', desc: 'مدمج (12-14 بند)' },
                  { scale: 90, label: '90% ⭐', desc: 'مضغوط (موصى به - 10-12 بند)' },
                  { scale: 95, label: '95%', desc: 'شبه عادي (8-10 بنود)' },
                  { scale: 100, label: '100%', desc: 'عادي (للمستندات القصيرة)' }
                ].map(item => (
                  <button
                    key={item.scale}
                    type="button"
                    onClick={() => setAppSettings(prev => ({ ...prev, printScale: item.scale }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                      (appSettings.printScale || 90) === item.scale
                        ? 'border-amber-400 bg-amber-500/25 text-amber-200 ring-2 ring-amber-400/50 shadow-sm'
                        : 'border-slate-700 bg-slate-900/60 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="font-mono">{item.label}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({item.desc})</span>
                  </button>
                ))}

                <div className="mr-auto flex items-center gap-2.5 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="text-xs font-bold text-slate-300 shrink-0">ضبط يدوي:</span>
                  <input
                    type="range"
                    min="75"
                    max="105"
                    step="1"
                    value={appSettings.printScale || 90}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, printScale: parseInt(e.target.value) || 90 }))}
                    className="w-24 sm:w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-xs font-mono font-black text-amber-300 min-w-[38px] text-center">
                    {appSettings.printScale || 90}%
                  </span>
                </div>
              </div>
            </div>
          )}
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
        <div
          id="print-content-area"
          className="w-full flex-1 bg-slate-800 p-4 sm:p-8 md:p-12 print:p-0 print:pt-0 print:bg-white overflow-x-auto flex flex-col items-center print-scaled-container"
          style={{
            ['--print-zoom' as any]: (appSettings.printScale || 90) / 100,
            ...(isMobileDevice && mobileFitWidth
              ? {
                  zoom: Math.min(1, Math.max(0.35, ((typeof window !== 'undefined' ? window.innerWidth : 390) - 24) / 794)),
                }
              : {
                  zoom: (appSettings.printScale || 90) / 100,
                }),
          }}
        >
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
          item.attachments && item.attachments.filter((att: any) => att.type?.startsWith('image/') || att.data).map((att: any, attIdx: number) => (
            <PrintPageWrapper key={`wo-att-${item.serialNumber || attIdx}-${attIdx}`} id={`wo-att-${item.serialNumber}-${attIdx}`} title={`مرفق صورة (${attIdx + 1}) - ${item.desc}`} className="print:break-before-page w-full h-[95vh] print:h-[95vh] flex flex-col items-center justify-center p-8">
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
                      {!item.isCustom && !item.isMaterial && item.chassis && (
                        <>
                          <div className="text-sm text-slate-700 mt-1">الشاصية: <span className="font-semibold">{item.chassis}</span> | الأبعاد: <span className="font-semibold">{item.length}x{item.width}x{item.height}m</span></div>
                          {(printData.data.type === 'نهائية' || printData.data.type === 'إنتاجية') && item.serialNumbers?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-sm font-mono text-slate-700 bg-slate-100 inline-block px-2 py-0.5 rounded font-bold">S/N: {item.serialNumbers.join(', ')}</span>
                              {item.mfgStatus && <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">الحالة: {item.mfgStatus}</span>}
                              {item.specialty && <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">المجال: {item.specialty}</span>}
                            </div>
                          )}
                        </>
                      )}
                      {(item.isMaterial || item.isCustom) && item.unit && (
                        <div className="text-xs text-slate-500 mt-0.5 font-medium">الوحدة: {item.unit}</div>
                      )}
                      {item.notes && (
                        <div className="text-xs text-slate-600 mt-1 font-medium bg-slate-50 border border-slate-200/80 p-1.5 rounded">
                          <span className="font-bold text-slate-700">ملاحظة:</span> {item.notes}
                        </div>
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

            {/* Official Signatures & Stamp Approval Row */}
            {(() => {
              const rawIssuer = printData.data.createdBy;

              // 1. البحث عن المنشئ الأصلي للفاتورة من سجل المستخدمين
              let creatorUser = (users || []).find((u: any) =>
                (typeof rawIssuer === 'object' && rawIssuer?.id && u.id === rawIssuer.id) ||
                (typeof rawIssuer === 'object' && rawIssuer?.name && (u.displayName === rawIssuer.name || u.username === rawIssuer.name)) ||
                (typeof rawIssuer === 'string' && (u.id === rawIssuer || u.displayName === rawIssuer || u.username === rawIssuer))
              );

              // 2. إذا لم يكن المنشئ مسجلاً في الفاتورة (فاتورة قديمة)، نبحث في سجل النشاطات عن من أنشأها
              if (!creatorUser && printData.data?.id) {
                const creationLog = (logs || []).find(l => l.actionType === 'create' && l.entityId === printData.data.id);
                if (creationLog) {
                  creatorUser = (users || []).find(u => u.id === creationLog.userId || u.displayName === creationLog.userDisplayName || u.username === creationLog.userName);
                }
              }

              // 3. فقط إذا كانت مسودة جديدة تماماً ولم يتم حفظها نعتمد المستخدم الحالي كمنشئ
              const fallbackUser = printData.data?.isDraft ? currentUser : null;
              const resolvedUser = creatorUser || fallbackUser;

              const issuerName = (typeof rawIssuer === 'object' && rawIssuer?.name)
                ? rawIssuer.name
                : (typeof rawIssuer === 'string' && rawIssuer ? rawIssuer : (resolvedUser?.displayName || resolvedUser?.username || 'المدير العام'));

              const issuerJobTitle = (typeof rawIssuer === 'object' && rawIssuer?.jobTitle)
                ? rawIssuer.jobTitle
                : (resolvedUser?.jobTitle || 'المدير العام');

              const issuerSignature = (typeof rawIssuer === 'object' && rawIssuer?.signature?.trim())
                ? rawIssuer.signature
                : (resolvedUser?.signature || '');

              const issuerStamp = (typeof rawIssuer === 'object' && rawIssuer?.stamp?.trim())
                ? rawIssuer.stamp
                : (resolvedUser?.stamp || '');

              const issuer = {
                name: issuerName,
                jobTitle: issuerJobTitle,
                signature: issuerSignature,
                stamp: issuerStamp
              };

              return (
                <div className="mt-8 pt-4 border-t-2 border-slate-300 break-inside-avoid flex justify-end">
                  {/* Official Company Approval, Signature & Stamp - No collision layout */}
                  <div className="w-full max-w-2xl border-2 border-slate-800 rounded-xl p-4 bg-white relative overflow-hidden flex flex-col justify-between shadow-xs">
                    <div className="font-bold text-slate-900 text-sm mb-3 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                      <span>اعتماد وإصدار الفاتورة</span>
                      <span className="text-xs font-semibold text-slate-500">{appSettings.companyNameAr || 'إدارة الشركة'}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 items-center pt-1">
                      {/* Creator / Issuer Info */}
                      <div className="space-y-1.5 text-right">
                        <div className="text-xs text-slate-500 font-medium">المسؤول المعتمد:</div>
                        <div className="font-black text-slate-900 text-base leading-snug">{issuer.name || 'المدير العام'}</div>
                        <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                          {issuer.jobTitle || 'المدير العام'}
                        </div>
                      </div>

                      {/* Official Signature - Separate dedicated area */}
                      <div className="flex flex-col items-center justify-center border-r border-l border-slate-100 px-2">
                        <span className="text-[11px] text-slate-400 font-bold mb-1">التوقيع المعتمد</span>
                        <div className="h-24 w-full flex items-center justify-center">
                          {issuer.signature ? (
                            <img
                              src={issuer.signature}
                              alt="التوقيع المعتمد"
                              className="max-h-24 max-w-[190px] object-contain select-none"
                            />
                          ) : (
                            <div className="text-center z-10 w-36">
                              <div className="border-b-2 border-slate-700 w-full mb-1"></div>
                              <span className="text-[10px] text-slate-400 font-semibold">التوقيع المعتمد</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Official Stamp - Separate dedicated area */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[11px] text-slate-400 font-bold mb-1">الختم الرسمي</span>
                        <div className="h-28 w-28 sm:h-32 sm:w-32 flex items-center justify-center">
                          {issuer.stamp ? (
                            <img
                              src={issuer.stamp}
                              alt="الختم الرسمي"
                              className="w-full h-full object-contain pointer-events-none select-none opacity-95"
                              style={{
                                mixBlendMode: 'multiply',
                                transform: 'rotate(-4deg)'
                              }}
                            />
                          ) : (
                            <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-semibold">
                              مكان الختم
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Footer Print Metadata Note */}
            {(() => {
              const docId = printData.data?.id;
              const currentPrintStats = (docId && printStats?.[docId]) || null;
              const pastAuditCount = (logs || []).filter(l => l.actionType === 'print' && l.entityId === docId).length;
              const printCountNumber = currentPrintStats?.count || (pastAuditCount > 0 ? pastAuditCount : 1);
              const printDate = new Date();
              const dateStr = printDate.toLocaleDateString('ar-LY');
              const timeStr = printDate.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
              const printedBy = currentUser?.displayName || currentUser?.username || 'المستخدم';

              return (
                <div className="mt-6 pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px] text-slate-500 font-medium break-inside-avoid">
                  <div className="flex items-center gap-2">
                    <span>طُبعت بواسطة: <strong className="text-slate-800">{printedBy}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span>تاريخ ووقت الطباعة: <strong className="text-slate-800 font-mono dir-ltr">{dateStr} {timeStr}</strong></span>
                  </div>
                  <div className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-slate-200">
                    عدد مرات الطباعة: {printCountNumber}
                  </div>
                </div>
              );
            })()}
          </PrintPageWrapper>
        )}

        {printData.type.includes('INVOICE') && printData.data.items.map((item, idx) => {
          if (item.isCustom || item.isMaterial) return null;
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
              <PrintCompanyHeader />

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

              {(() => {
                const soIssuer = typeof printData.data.issuedBy === 'object' && printData.data.issuedBy !== null
                  ? printData.data.issuedBy
                  : {
                      name: typeof printData.data.issuedBy === 'string' ? printData.data.issuedBy : '',
                      jobTitle: printData.data.issuedByJobTitle || '',
                      signature: printData.data.issuedBySignature || '',
                      stamp: printData.data.issuedByStamp || ''
                    };

                return (
                  <div className="border-2 border-slate-800 rounded-xl p-4 bg-slate-50 break-inside-avoid">
                    <h3 className="text-lg font-bold mb-2">إقرار الناقل (السائق)</h3>
                    <p className="leading-relaxed mb-6">أقر أنا الموقع أدناه السيد / <span className="font-bold">{printData.data.driver?.name}</span>، بأنني استلمت المنتجات المذكورة أعلاه ومحتوياتها بحالة ممتازة وجاهزة للنقل إلى (<span className="font-bold">{printData.data.destination}</span>) تحت مسؤوليتي الكاملة.</p>
                    <div className="grid grid-cols-2 gap-8 items-end px-4">
                      <div className="text-center flex flex-col justify-between min-h-[175px] py-1">
                        <div>
                          <div className="font-bold mb-1 text-slate-900 text-base">توقيع المستلم (السائق)</div>
                          <div className="text-sm text-slate-600">{printData.data.driver?.name}</div>
                        </div>
                        <div className="w-56 mx-auto">
                          <div className="border-b-2 border-slate-800 w-full mb-1"></div>
                          <span className="text-xs text-slate-400 font-medium">توقيع السائق</span>
                        </div>
                      </div>

                      <div className="border-2 border-slate-800 rounded-xl p-4 bg-white relative flex flex-col justify-between min-h-[175px]">
                        <div className="text-xs font-bold text-slate-800 mb-1 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                          <span>اعتماد التسليم (المصنع)</span>
                          <span className="font-semibold text-slate-500">{appSettings.companyNameAr || 'إدارة المصنع'}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 relative flex-1 pt-1">
                          <div className="z-10 space-y-1">
                            <div className="text-[11px] text-slate-400 font-medium">المسؤول المعتمد:</div>
                            <div className="font-black text-slate-900 text-base">{soIssuer.name || 'إدارة المصنع'}</div>
                            <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block">
                              {soIssuer.jobTitle || 'مسؤول الحركة والتسليم'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Signature */}
                            <div className="flex flex-col items-center justify-center min-w-[120px]">
                              {soIssuer.signature ? (
                                <img
                                  src={soIssuer.signature}
                                  alt="توقيع المصنع"
                                  className="max-h-20 max-w-[140px] object-contain relative z-20"
                                />
                              ) : (
                                <div className="border-b-2 border-slate-800 w-32 mb-1 text-center">
                                  <span className="text-[10px] text-slate-400">التوقيع</span>
                                </div>
                              )}
                            </div>
                            {/* Stamp */}
                            {soIssuer.stamp && (
                              <div className="w-24 h-24 flex items-center justify-center shrink-0">
                                <img
                                  src={soIssuer.stamp}
                                  alt="ختم المصنع"
                                  className="w-full h-full object-contain pointer-events-none select-none z-10 opacity-90"
                                  style={{
                                    mixBlendMode: 'multiply',
                                    transform: 'rotate(-5deg)'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Print Metadata Note */}
                    {(() => {
                      const docId = printData.data?.id;
                      const currentPrintStats = (docId && printStats?.[docId]) || null;
                      const pastAuditCount = (logs || []).filter(l => l.actionType === 'print' && l.entityId === docId).length;
                      const printCountNumber = currentPrintStats?.count || (pastAuditCount > 0 ? pastAuditCount : 1);
                      const printDate = new Date();
                      const dateStr = printDate.toLocaleDateString('ar-LY');
                      const timeStr = printDate.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
                      const printedBy = currentUser?.displayName || currentUser?.username || 'المستخدم';

                      return (
                        <div className="mt-6 pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px] text-slate-500 font-medium break-inside-avoid">
                          <div className="flex items-center gap-2">
                            <span>طُبعت بواسطة: <strong className="text-slate-800">{printedBy}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>تاريخ ووقت الطباعة: <strong className="text-slate-800 font-mono dir-ltr">{dateStr} {timeStr}</strong></span>
                          </div>
                          <div className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-slate-200">
                            عدد مرات الطباعة: {printCountNumber}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </PrintPageWrapper>

            <PrintPageWrapper id="shipping-order-customer" title="إيصال استلام - الزبون">
              <PrintCompanyHeader />

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

              {(() => {
                const soIssuer = typeof printData.data.issuedBy === 'object' && printData.data.issuedBy !== null
                  ? printData.data.issuedBy
                  : {
                      name: typeof printData.data.issuedBy === 'string' ? printData.data.issuedBy : '',
                      jobTitle: printData.data.issuedByJobTitle || '',
                      signature: printData.data.issuedBySignature || '',
                      stamp: printData.data.issuedByStamp || ''
                    };

                return (
                  <div className="border-2 border-slate-800 rounded-xl p-4 bg-slate-50 break-inside-avoid">
                    <h3 className="text-lg font-bold mb-2">إقرار استلام الزبون</h3>
                    <p className="leading-relaxed mb-6">أقر أنا الموقع أدناه بأنني استلمت المنتجات المذكورة أعلاه بجميع مرفقاتها ومحتوياتها الموضحة في هذا الإيصال، وهي بحالة ممتازة وبدون أي عيوب أو أضرار ظاهرة.</p>
                    <div className="grid grid-cols-2 gap-8 mb-4 px-4 items-end">
                      <div className="space-y-4">
                        <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">اسم المستلم:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                        <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">الصفة:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                        <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">تاريخ الاستلام:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                        <div className="flex gap-2 items-end"><span className="font-bold whitespace-nowrap">التوقيع:</span><div className="border-b-2 border-slate-400 border-dashed flex-1 h-6"></div></div>
                      </div>

                      {/* Factory Outbound Authorization */}
                      <div className="border-2 border-slate-800 rounded-xl p-4 bg-white relative flex flex-col justify-between min-h-[175px]">
                        <div className="text-xs font-bold text-slate-800 mb-1 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                          <span>اعتماد خروج وتسليم المنتجات</span>
                          <span className="font-semibold text-slate-500">{appSettings.companyNameAr || 'إدارة المصنع'}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 relative flex-1 pt-1">
                          <div className="z-10 space-y-1">
                            <div className="text-[11px] text-slate-400 font-medium">المسؤول المعتمد:</div>
                            <div className="font-black text-slate-900 text-base">{soIssuer.name || 'إدارة المصنع'}</div>
                            <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block">
                              {soIssuer.jobTitle || 'مسؤول الحركة والتسليم'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Signature */}
                            <div className="flex flex-col items-center justify-center min-w-[120px]">
                              {soIssuer.signature ? (
                                <img
                                  src={soIssuer.signature}
                                  alt="توقيع المصنع"
                                  className="max-h-20 max-w-[140px] object-contain relative z-20"
                                />
                              ) : (
                                <div className="border-b-2 border-slate-800 w-32 mb-1 text-center">
                                  <span className="text-[10px] text-slate-400">التوقيع</span>
                                </div>
                              )}
                            </div>
                            {/* Stamp */}
                            {soIssuer.stamp && (
                              <div className="w-24 h-24 flex items-center justify-center shrink-0">
                                <img
                                  src={soIssuer.stamp}
                                  alt="ختم المصنع"
                                  className="w-full h-full object-contain pointer-events-none select-none z-10 opacity-90"
                                  style={{
                                    mixBlendMode: 'multiply',
                                    transform: 'rotate(-5deg)'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Print Metadata Note */}
                    {(() => {
                      const docId = printData.data?.id;
                      const currentPrintStats = (docId && printStats?.[docId]) || null;
                      const pastAuditCount = (logs || []).filter(l => l.actionType === 'print' && l.entityId === docId).length;
                      const printCountNumber = currentPrintStats?.count || (pastAuditCount > 0 ? pastAuditCount : 1);
                      const printDate = new Date();
                      const dateStr = printDate.toLocaleDateString('ar-LY');
                      const timeStr = printDate.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
                      const printedBy = currentUser?.displayName || currentUser?.username || 'المستخدم';

                      return (
                        <div className="mt-6 pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px] text-slate-500 font-medium break-inside-avoid">
                          <div className="flex items-center gap-2">
                            <span>طُبعت بواسطة: <strong className="text-slate-800">{printedBy}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>تاريخ ووقت الطباعة: <strong className="text-slate-800 font-mono dir-ltr">{dateStr} {timeStr}</strong></span>
                          </div>
                          <div className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-slate-200">
                            عدد مرات الطباعة: {printCountNumber}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </PrintPageWrapper>

            {printData.data.attachments && printData.data.attachments.filter((att: any) => att.type?.startsWith('image/') || att.data).map((att: any, attIdx: number) => (
              <PrintPageWrapper key={`shp-att-${attIdx}`} id={`shp-att-${attIdx}`} title={`مرفق أمر نقل`} className="print:break-before-page w-full h-[95vh] print:h-[95vh] flex flex-col items-center justify-center p-8">
                <PrintCompanyHeader />
                <h2 className="text-xl font-bold mb-4 text-center text-slate-800 w-full border-b pb-2">مرفق أمر النقل: {printData.data.id} - صورة ({attIdx + 1})</h2>
                <img src={att.data} alt={att.name || `مرفق ${attIdx + 1}`} className="max-w-full max-h-full object-contain" style={{ maxHeight: '75vh' }} />
              </PrintPageWrapper>
            ))}
          </>
        )}
        {printData.type === 'LETTER' && (
          <PrintPageWrapper id="letter-main" title={`رسالة: ${printData.data.subject}`}>
            <PrintCompanyHeader className="mb-8" />

            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500 whitespace-nowrap">الرقم الإشاري (Ref):</span>
                <span className="text-base font-bold font-mono text-slate-800">{printData.data.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500 whitespace-nowrap">التاريخ (Date):</span>
                <span className="text-base font-bold font-mono text-slate-800">{formatDateYMD(printData.data.date)}</span>
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

            <div className="mt-12 pt-4 flex justify-end break-inside-avoid">
               <div className="text-center w-80 relative">
                 <div className="font-bold text-slate-900 text-lg mb-0.5">{printData.data.senderName}</div>
                 <div className="text-slate-600 text-sm mb-2 font-medium">{printData.data.senderTitle}</div>
                 
                 {/* Signature & Stamp container - Real Life Proportions */}
                 <div className="relative flex items-center justify-center min-h-[140px] my-1">
                   {printData.data.senderStamp && (
                     <img
                       src={printData.data.senderStamp}
                       alt="الختم الرسمي"
                       className="absolute w-36 h-36 object-contain pointer-events-none select-none z-10 opacity-90"
                       style={{
                         mixBlendMode: 'multiply',
                         transform: 'rotate(-6deg)'
                       }}
                     />
                   )}
                   {printData.data.senderSignature ? (
                     <img
                       src={printData.data.senderSignature}
                       alt="التوقيع المعتمد"
                       className="max-h-24 max-w-[240px] object-contain relative z-20"
                     />
                   ) : (
                     <div className="h-16"></div>
                   )}
                 </div>

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
                  <img src={appSettings.logoBase64 || shamsLogo} alt="Company Logo" className="h-24 w-auto object-contain" style={{ maxHeight: '6rem', maxWidth: '16rem', objectFit: 'contain' }} />
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
        {printData.type === 'PURCHASE_INVOICE' && (
          <>
            <PrintPageWrapper id="main-purchase-invoice" title="فاتورة مشتريات">
              <PrintCompanyHeader className="pb-4 mb-4" />

              <div className="text-center mb-6">
                <h1 className="text-2xl font-black text-slate-900 mb-1 underline">فاتورة مشتريات</h1>
                <div className="text-slate-600 text-sm">التاريخ: {new Date(printData.data.date).toLocaleDateString('ar-LY')} | المرجع: <span className="font-mono">{printData.data.id}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-300">
                <div>
                  <div className="text-xs text-slate-500 font-bold mb-1">المورد:</div>
                  <div className="font-bold text-slate-800 text-lg">{printData.data.supplierName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold mb-1">رقم فاتورة المورد:</div>
                  <div className="font-bold text-slate-800 font-mono text-base">{printData.data.invoiceNumber || '-'}</div>
                </div>
              </div>

              <table className="w-full text-right border-collapse mb-6">
                <thead>
                  <tr className="bg-slate-200 border-y border-slate-800">
                    <th className="p-3 border-l border-slate-400 text-center w-12">#</th>
                    <th className="p-3 border-l border-slate-400">الصنف / المادة</th>
                    <th className="p-3 border-l border-slate-400 text-center w-28">الكمية</th>
                    <th className="p-3 border-l border-slate-400 text-center w-32">سعر الوحدة</th>
                    <th className="p-3 text-center w-36">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.data.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="p-3 border-l border-slate-300 text-center">{i + 1}</td>
                      <td className="p-3 border-l border-slate-300 font-bold">{item.itemName}</td>
                      <td className="p-3 border-l border-slate-300 text-center font-bold">{item.qty} {item.unit}</td>
                      <td className="p-3 border-l border-slate-300 text-center font-mono dir-ltr">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-center font-mono font-bold dir-ltr">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-72 bg-slate-100 p-4 border border-slate-300 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600">المجموع:</span>
                    <span className="font-bold font-mono dir-ltr">{formatCurrency(printData.data.total)}</span>
                  </div>
                  {printData.data.discount > 0 && (
                    <div className="flex justify-between items-center text-sm text-red-600">
                      <span className="font-bold">الخصم:</span>
                      <span className="font-bold font-mono dir-ltr">-{formatCurrency(printData.data.discount)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-base">
                    <span className="font-black text-slate-800">الصافي:</span>
                    <span className="font-black font-mono text-indigo-700 dir-ltr">{formatCurrency(printData.data.netTotal)}</span>
                  </div>
                </div>
              </div>

              {printData.data.notes && (
                <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <div className="font-bold text-slate-700 mb-1">ملاحظات:</div>
                  <div className="text-slate-600 whitespace-pre-wrap">{printData.data.notes}</div>
                </div>
              )}
            </PrintPageWrapper>
            {printData.data.attachments && printData.data.attachments.filter((att: any) => att.type.startsWith('image/')).map((att: any, attIdx: number) => (
              <PrintPageWrapper key={`pur-att-${attIdx}`} id={`pur-att-${attIdx}`} title="مرفق فاتورة مشتريات" className="print:break-before-page w-full h-[95vh] print:h-[95vh] flex flex-col items-center justify-center p-8">
                <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 w-full border-b pb-4">مرفق فاتورة مشتريات: {printData.data.supplierName} ({printData.data.invoiceNumber || printData.data.id})</h2>
                <img src={att.data} alt={att.name} className="max-w-full max-h-full object-contain" style={{ maxHeight: '85vh' }} />
              </PrintPageWrapper>
            ))}
          </>
        )}

        {printData.type === 'HR_PAYROLL' && (
          <PrintPageWrapper id="hr-payroll-sheet" title={`كشف مسير رواتب شهر ${printData.data.month}`}>
            <PrintCompanyHeader className="pb-4 mb-4" />
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900">كشف مسير رواتب واستحقاقات العاملين</h1>
                <div className="text-sm font-bold text-slate-600 mt-1">
                  عن شهر: <span className="font-mono text-slate-900 text-base">{printData.data.month}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                تاريخ الاستخراج: {new Date(printData.data.generatedAt).toLocaleDateString('ar-LY')} • طُبع بواسطة: {printData.data.printedBy}
              </div>
            </div>

            <table className="w-full text-right text-xs border-collapse border border-slate-400 mb-6">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400">
                <tr>
                  <th className="p-2 border border-slate-300 w-8 text-center">#</th>
                  <th className="p-2 border border-slate-300 w-12 text-center">كود</th>
                  <th className="p-2 border border-slate-300">اسم الموظف</th>
                  <th className="p-2 border border-slate-300">القسم والوظيفة</th>
                  <th className="p-2 border border-slate-300 text-center">نظام الراتب</th>
                  <th className="p-2 border border-slate-300 text-center">الأساسي</th>
                  <th className="p-2 border border-slate-300 text-center">حضور/غياب</th>
                  <th className="p-2 border border-slate-300 text-center">تأخير (د.ل)</th>
                  <th className="p-2 border border-slate-300 text-center">إضافي (د.ل)</th>
                  <th className="p-2 border border-slate-300 text-center">مكافآت</th>
                  <th className="p-2 border border-slate-300 text-center">سلفيات وخصم</th>
                  <th className="p-2 border border-slate-300 text-center font-black bg-slate-200">صافي المستحق</th>
                  <th className="p-2 border border-slate-300 text-center w-28">توقيع المستلم</th>
                </tr>
              </thead>
              <tbody>
                {printData.data.items.map((item: any, idx: number) => {
                  const totalBonuses = (item.bonuses || 0) + (item.allowances || 0);
                  const totalDeductions = (item.advances || 0) + (item.deductions || 0);
                  return (
                    <tr key={item.employeeId} className="border-b border-slate-300">
                      <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">{item.badgeNumber}</td>
                      <td className="p-2 border border-slate-300 font-bold text-slate-900">{item.employeeName}</td>
                      <td className="p-2 border border-slate-300 text-slate-700">{item.deptName} - {item.jobTitle}</td>
                      <td className="p-2 border border-slate-300 text-center font-medium">{item.salaryType === 'daily' ? 'يومية' : 'شهري'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold dir-ltr">{formatCurrency(item.baseSalaryOrRate)}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{item.actualWorkDays} / {item.absentDays}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-red-700 dir-ltr">{item.lateDeduction > 0 ? `-${formatCurrency(item.lateDeduction)}` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-purple-700 font-bold dir-ltr">{item.overtimeAmount > 0 ? `+${formatCurrency(item.overtimeAmount)}` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-emerald-700 dir-ltr">{totalBonuses > 0 ? `+${formatCurrency(totalBonuses)}` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-red-700 dir-ltr">{totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-black font-mono bg-slate-100 text-slate-900 dir-ltr text-sm">{formatCurrency(item.netSalary)} د.ل</td>
                      <td className="p-2 border border-slate-300"></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-200 font-black border-t-2 border-slate-500 text-slate-900">
                <tr>
                  <td colSpan={5} className="p-2.5 text-right font-black">الإجمالي العام لمسير الرواتب:</td>
                  <td className="p-2.5 text-center font-mono dir-ltr">{formatCurrency(printData.data.totals.totalBase)}</td>
                  <td></td>
                  <td className="p-2.5 text-center font-mono text-red-700 dir-ltr">-{formatCurrency(printData.data.totals.totalLateDeductions)}</td>
                  <td className="p-2.5 text-center font-mono text-purple-800 dir-ltr">+{formatCurrency(printData.data.totals.totalOvertime)}</td>
                  <td className="p-2.5 text-center font-mono text-emerald-800 dir-ltr">+{formatCurrency(printData.data.totals.totalBonuses)}</td>
                  <td className="p-2.5 text-center font-mono text-red-700 dir-ltr">-{formatCurrency(printData.data.totals.totalAdvances)}</td>
                  <td className="p-2.5 text-center font-black font-mono text-base bg-slate-300 dir-ltr">{formatCurrency(printData.data.totals.totalNet)} د.ل</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div className="bg-slate-50 p-3 border border-slate-300 rounded mb-8 text-sm">
              <span className="font-bold text-slate-700">فقط وقدره: </span>
              <span className="font-bold text-blue-900">{numberToArabicWords(printData.data.totals.totalNet)} دينار ليبي لا غير.</span>
            </div>

            {/* Official Signatures Row */}
            <div className="grid grid-cols-3 gap-6 pt-6 mt-6 border-t-2 border-slate-300 text-center break-inside-avoid">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">إعداد المحاسب</div>
                <div className="h-16 border-b border-dashed border-slate-400"></div>
                <div className="text-xs font-bold text-slate-700 mt-2">التوقيع والتاريخ</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">تدقيق ومراجعة الموارد البشرية</div>
                <div className="h-16 border-b border-dashed border-slate-400"></div>
                <div className="text-xs font-bold text-slate-700 mt-2">مسؤول الموارد البشرية</div>
              </div>
              <div className="relative">
                <div className="text-xs font-bold text-slate-500 mb-1">اعتماد الصرف (المدير العام)</div>
                <div className="h-16 border-b border-dashed border-slate-400 flex items-center justify-center">
                  {currentUser?.signature && (
                    <img src={currentUser.signature} alt="توقيع" className="max-h-14 object-contain" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-700 mt-2">الختم والاعتماد الرسمي</div>
              </div>
            </div>
          </PrintPageWrapper>
        )}

        {printData.type === 'HR_TIMECARD' && (
          <PrintPageWrapper id="hr-timecard-sheet" title={`بطاقة حضور ${printData.data.employee.name}`}>
            <PrintCompanyHeader className="pb-4 mb-4" />
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900">بطاقة الحضور والانصراف الشهرية</h1>
                <div className="text-sm font-bold text-slate-600 mt-1">
                  عن شهر: <span className="font-mono text-slate-900 text-base">{printData.data.month}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                تاريخ الاستخراج: {new Date().toLocaleDateString('ar-LY')}
              </div>
            </div>

            <div className="bg-slate-100 p-4 border border-slate-300 rounded mb-6 text-sm grid grid-cols-3 gap-4">
              <div>اسم الموظف: <span className="font-bold text-slate-900 text-base">{printData.data.employee.name}</span></div>
              <div>رقم البصمة (الكود): <span className="font-mono font-bold text-slate-900">{printData.data.employee.badgeNumber}</span></div>
              <div>القسم: <span className="font-bold text-slate-900">{printData.data.employee.deptName || 'عام'}</span></div>
              <div>المسمى الوظيفي: <span className="font-bold text-slate-900">{printData.data.employee.jobTitle || 'موظف'}</span></div>
              <div>أيام الحضور الفعلية: <span className="font-bold text-emerald-800">{printData.data.stats.actualWorkDays} / {printData.data.stats.expectedDays}</span></div>
              <div>إجمالي التأخير: <span className="font-mono font-bold text-amber-800">{printData.data.stats.totalLateMinutes} دقيقة</span></div>
            </div>

            <table className="w-full text-right text-xs border-collapse border border-slate-400 mb-6">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400">
                <tr>
                  <th className="p-2 border border-slate-300 w-8 text-center">#</th>
                  <th className="p-2 border border-slate-300">التاريخ</th>
                  <th className="p-2 border border-slate-300">اليوم</th>
                  <th className="p-2 border border-slate-300">الوردية</th>
                  <th className="p-2 border border-slate-300 text-center">أول بصمة (حضور)</th>
                  <th className="p-2 border border-slate-300 text-center">آخر بصمة (انصراف)</th>
                  <th className="p-2 border border-slate-300 text-center">ساعات العمل</th>
                  <th className="p-2 border border-slate-300 text-center">التأخير</th>
                  <th className="p-2 border border-slate-300 text-center">الإضافي</th>
                  <th className="p-2 border border-slate-300 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {printData.data.dailyDetails.map((day: any, idx: number) => {
                  const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'long' });
                  return (
                    <tr key={day.date} className="border-b border-slate-300">
                      <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 font-mono">{day.date}</td>
                      <td className="p-2 border border-slate-300 font-bold">{dayName}</td>
                      <td className="p-2 border border-slate-300">{day.shift.name}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">{day.firstIn || '--:--'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">{day.lastOut || '--:--'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{day.workedHours > 0 ? `${day.workedHours} س` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{day.lateMinutes > 0 ? `${day.lateMinutes} د` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{day.overtimeHours > 0 ? `+${day.overtimeHours} س` : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center font-bold">
                        {day.status === 'present' ? 'حاضر' :
                         day.status === 'late' ? 'متأخر' :
                         day.status === 'single_punch' ? 'بصمة مفردة' :
                         day.status === 'leave' ? 'إجازة' :
                         day.status === 'weekend' ? 'عطلة' : 'غائب'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-400">
                <tr>
                  <td colSpan={6} className="p-2 text-right">الإجمالي الشهري:</td>
                  <td className="p-2 text-center font-mono">{printData.data.stats.totalWorkedHours} س</td>
                  <td className="p-2 text-center font-mono">{printData.data.stats.totalLateMinutes} د</td>
                  <td className="p-2 text-center font-mono">+{printData.data.stats.totalOvertimeHours} س</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div className="grid grid-cols-2 gap-8 pt-6 mt-6 border-t-2 border-slate-300 text-center break-inside-avoid">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">إقرار وتوقيع الموظف</div>
                <div className="h-16 border-b border-dashed border-slate-400"></div>
                <div className="text-xs font-bold text-slate-700 mt-2">توقيع الموظف بالعلم</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">اعتماد مسؤول الموارد البشرية</div>
                <div className="h-16 border-b border-dashed border-slate-400"></div>
                <div className="text-xs font-bold text-slate-700 mt-2">الختم والاعتماد</div>
              </div>
            </div>
          </PrintPageWrapper>
        )}

        {printData.type === 'HR_PAYSLIPS' && (
          <>
            {printData.data.slips.map((slip: any, slipIdx: number) => {
              const emp = slip.employee || {};
              const item = slip.item || {};
              const stats = slip.stats || {};
              const dailyDetails = slip.dailyDetails || [];
              const totalGross = (item.earnedSalary || item.baseSalaryOrRate || 0) + (item.overtimeAmount || 0) + (item.bonuses || 0) + (item.allowances || 0);
              const totalDeductions = (item.lateDeduction || 0) + (item.earlyDeduction || 0) + (item.advances || 0) + (item.deductions || 0);
              const slipId = `hr-payslip-${emp.id || slipIdx}`;

              return (
                <PrintPageWrapper key={slipId} id={slipId} title={`قسيمة راتب: ${emp.name || item.employeeName}`} className={slipIdx > 0 ? 'print:break-before-page' : ''}>
                  <PrintCompanyHeader className="pb-3 mb-3" />

                  {/* Header Title & Month Info */}
                  <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-4">
                    <div>
                      <h1 className="text-xl font-black text-slate-900">قسيمة استحقاق مرتب ومفردات الراتب</h1>
                      <div className="text-xs font-bold text-slate-600 mt-0.5">
                        عن شهر: <span className="font-mono text-slate-900 text-sm">{printData.data.month}</span>
                        {printData.data.startDate && printData.data.endDate && (
                          <span className="mr-2 text-slate-500 font-mono">({printData.data.startDate} إلى {printData.data.endDate})</span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono text-left" dir="ltr">
                      <div>Generated: {new Date(printData.data.generatedAt).toLocaleDateString('ar-LY')}</div>
                      <div>User: {printData.data.printedBy}</div>
                    </div>
                  </div>

                  {/* Employee Details Box */}
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium">اسم الموظف:</span>
                      <strong className="text-slate-900 text-sm">{emp.name || item.employeeName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">الرقم الوظيفي / الكود:</span>
                      <strong className="text-slate-900 font-mono text-sm">{emp.badgeNumber || item.badgeNumber || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">القسم والوظيفة:</span>
                      <strong className="text-slate-800">{emp.deptName || item.deptName || '-'} • {emp.jobTitle || item.jobTitle || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">نظام الراتب والأساسي:</span>
                      <strong className="text-slate-800">
                        {emp.salaryType === 'daily' ? 'يومية: ' : 'شهري: '}
                        <span className="font-mono text-blue-900 font-black">{formatCurrency(item.baseSalaryOrRate || emp.basicSalary || emp.dailyRate || 0)} د.ل</span>
                      </strong>
                    </div>
                  </div>

                  {/* Financial Breakdown: Earnings vs Deductions */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* الاستحقاقات (Earnings) */}
                    <div className="border border-emerald-300 rounded-lg overflow-hidden">
                      <div className="bg-emerald-50 text-emerald-900 font-black text-xs px-3 py-1.5 border-b border-emerald-200 flex justify-between items-center">
                        <span>الاستحقاقات والإضافات (+)</span>
                        <span className="font-mono text-[11px]">أيام العمل الفعلية: {item.actualWorkDays || 0}</span>
                      </div>
                      <table className="w-full text-xs text-right">
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-2 text-slate-700">الراتب الأساسي / المستحق للأيام الفعلية</td>
                            <td className="p-2 font-mono font-bold text-slate-900 text-left dir-ltr">{formatCurrency(item.earnedSalary || item.baseSalaryOrRate || 0)} د.ل</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-slate-700">العمل الإضافي ({item.overtimeHours || 0} ساعة)</td>
                            <td className="p-2 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(item.overtimeAmount || 0)} د.ل</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-slate-700">المكافآت والتشجيع</td>
                            <td className="p-2 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(item.bonuses || 0)} د.ل</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-slate-700">البدلات والحوافز</td>
                            <td className="p-2 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(item.allowances || 0)} د.ل</td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-emerald-100/60 font-bold border-t border-emerald-200">
                          <tr>
                            <td className="p-2 text-emerald-900">إجمالي الاستحقاقات:</td>
                            <td className="p-2 font-mono font-black text-emerald-900 text-left dir-ltr">{formatCurrency(totalGross)} د.ل</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* الاستقطاعات (Deductions) */}
                    <div className="border border-red-300 rounded-lg overflow-hidden">
                      <div className="bg-red-50 text-red-900 font-black text-xs px-3 py-1.5 border-b border-red-200 flex justify-between items-center">
                        <span>الخصومات والاستقطاعات (-)</span>
                        <span className="font-mono text-[11px]">أيام الغياب: {item.absentDays || 0}</span>
                      </div>
                      <table className="w-full text-xs text-right">
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-2 text-slate-700">خصم التأخير والخروج المبكر ({item.delayMinutes || item.lateMinutes || 0} دقيقة)</td>
                            <td className="p-2 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(item.delayDeduction || item.lateDeduction || 0)} د.ل</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-slate-700">السلفيات والمسحوبات المستحقة</td>
                            <td className="p-2 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(item.advances || 0)} د.ل</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-slate-700">الجزاءات والخصومات المباشرة</td>
                            <td className="p-2 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(item.deductions || 0)} د.ل</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-slate-500 italic">غياب بدون إذن ({item.absentDays || 0} يوم)</td>
                            <td className="p-2 font-mono text-slate-500 text-left dir-ltr">-</td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-red-100/60 font-bold border-t border-red-200">
                          <tr>
                            <td className="p-2 text-red-900">إجمالي الاستقطاعات:</td>
                            <td className="p-2 font-mono font-black text-red-900 text-left dir-ltr">-{formatCurrency(totalDeductions)} د.ل</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Net Payable Banner */}
                  <div className="bg-slate-900 text-white rounded-lg p-3 mb-4 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-slate-300 font-bold">صافي الراتب المستحق للصرف:</div>
                      <div className="text-xs text-amber-300 mt-0.5">
                        فقط: {numberToArabicWords(item.netSalary || 0)} دينار ليبي لا غير.
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-400 dir-ltr">
                      {formatCurrency(item.netSalary || 0)} <span className="text-xs font-sans text-slate-200">د.ل</span>
                    </div>
                  </div>

                  {/* Attendance Summary Mini-Table */}
                  {dailyDetails.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>سجل حضور وانصراف الموظف خلال الفترة ({dailyDetails.length} يوم):</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          حضور: {stats.actualWorkDays || 0} • غياب: {stats.absentDays || 0} • تأخير: {stats.totalLateMinutes || 0} دقيقة • إضافي: {stats.totalOvertimeHours || 0} ساعة
                        </span>
                      </div>
                      <div className="border border-slate-300 rounded overflow-hidden">
                        <table className="w-full text-right text-[10px] border-collapse">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                            <tr>
                              <th className="p-1 border-l border-slate-200 text-center w-7">#</th>
                              <th className="p-1 border-l border-slate-200 text-center">التاريخ</th>
                              <th className="p-1 border-l border-slate-200 text-center">اليوم</th>
                              <th className="p-1 border-l border-slate-200 text-center">دخول ص (1)</th>
                              <th className="p-1 border-l border-slate-200 text-center">خروج ص (1)</th>
                              <th className="p-1 border-l border-slate-200 text-center">دخول م (2)</th>
                              <th className="p-1 border-l border-slate-200 text-center">خروج م (2)</th>
                              <th className="p-1 border-l border-slate-200 text-center">ساعات العمل</th>
                              <th className="p-1 border-l border-slate-200 text-center">تأخير</th>
                              <th className="p-1 border-l border-slate-200 text-center">إضافي</th>
                              <th className="p-1 text-center">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {dailyDetails.map((day: any, dIdx: number) => {
                              const dayNameAr = new Date(day.date + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'short' });
                              return (
                                <tr key={day.date} className={`border-b border-slate-200 ${day.status === 'absent' ? 'bg-red-50/50' : day.status === 'weekend' ? 'bg-slate-50/70' : ''}`}>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-slate-500">{dIdx + 1}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono">{day.date.slice(5)}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-semibold text-slate-600">{dayNameAr}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-emerald-800">{day.morningIn || '-'}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-blue-800">{day.morningOut || '-'}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-purple-800">{day.eveningIn || '-'}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-indigo-800">{day.eveningOut || '-'}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono">{day.workedHours > 0 ? `${day.workedHours} س` : '-'}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-red-600">{day.lateMinutes > 0 ? `${day.lateMinutes} د` : '-'}</td>
                                  <td className="p-1 border-l border-slate-200 text-center font-mono text-purple-700 font-bold">{day.overtimeHours > 0 ? `+${day.overtimeHours} س` : '-'}</td>
                                  <td className="p-1 text-center font-bold">
                                    {day.status === 'present' && <span className="text-emerald-700">حاضر</span>}
                                    {day.status === 'late' && <span className="text-amber-700">متأخر</span>}
                                    {day.status === 'absent' && <span className="text-red-700">غائب</span>}
                                    {day.status === 'leave' && <span className="text-blue-700">إجازة</span>}
                                    {day.status === 'weekend' && <span className="text-slate-500">عطلة</span>}
                                    {day.status === 'single_punch' && <span className="text-purple-700">بصمة مفردة</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Signatures Row */}
                  <div className="grid grid-cols-3 gap-6 pt-4 border-t-2 border-slate-300 text-center break-inside-avoid">
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 mb-1">إعداد المحاسب</div>
                      <div className="h-12 border-b border-dashed border-slate-400"></div>
                      <div className="text-[11px] font-bold text-slate-700 mt-1">توقيع المحاسب</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 mb-1">تدقيق الموارد البشرية</div>
                      <div className="h-12 border-b border-dashed border-slate-400"></div>
                      <div className="text-[11px] font-bold text-slate-700 mt-1">مسؤول الموارد البشرية</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 mb-1">إقرار وتوقيع الموظف المستلم</div>
                      <div className="h-12 border-b border-dashed border-slate-400"></div>
                      <div className="text-[11px] font-bold text-slate-700 mt-1">توقيع الموظف بالعلم والاستلام</div>
                    </div>
                  </div>
                </PrintPageWrapper>
              );
            })}
          </>
        )}

        {printData.type === 'HR_SETTLEMENT' && (() => {
          const s = printData.data.settlement;
          return (
            <PrintPageWrapper id="hr-settlement-sheet" title={`مخالصة نهائية وتصفية مستحقات: ${s.employeeName}`}>
              <PrintCompanyHeader className="pb-3 mb-4" />

              {/* Title & Ref */}
              <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">مخالصة نهائية وتصفية مستحقات نهاية الخدمة</h1>
                  <div className="text-xs font-bold text-slate-600 mt-1">
                    رقم وثيقة التصفية: <span className="font-mono text-slate-900 font-bold">{s.id}</span>
                  </div>
                </div>
                <div className="text-left text-xs text-slate-500 font-mono" dir="ltr">
                  <div>Date: {new Date(s.settlementDate || printData.data.generatedAt).toLocaleDateString('ar-LY')}</div>
                  <div>Processed By: {printData.data.printedBy}</div>
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">اسم الموظف:</span>
                  <strong className="text-slate-900 text-sm">{s.employeeName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">الرقم الوظيفي:</span>
                  <strong className="text-slate-900 font-mono text-sm">{s.badgeNumber || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">القسم والوظيفة:</span>
                  <strong className="text-slate-800">{s.deptName || '-'} • {s.jobTitle || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">تاريخ المباشرة والانفصال:</span>
                  <strong className="text-slate-800 font-mono">{s.joinDate || '-'} إلى {s.leaveDate || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">سبب إنهاء الخدمة:</span>
                  <strong className="text-blue-900">{s.reason || 'انتهاء الخدمة'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">فترة الاحتساب المعتمدة:</span>
                  <strong className="text-slate-800 font-mono">{s.startDate} إلى {s.endDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">أيام العمل وساعات العمل:</span>
                  <strong className="text-slate-800 font-mono">{s.workedDays} يوم عمل ({s.workedHours} ساعة)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">طريقة صرف المستحقات:</span>
                  <strong className="text-slate-800">{s.paymentMethod === 'cash' ? 'نقداً (خزينة)' : 'تحويل مصرفي'}</strong>
                </div>
              </div>

              {/* Settlement Table: Earnings vs Deductions */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* الإضافات والمستحقات */}
                <div className="border border-emerald-300 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 text-emerald-950 font-black text-sm px-4 py-2 border-b border-emerald-200">
                    مفردات المستحقات والإضافات (+)
                  </div>
                  <table className="w-full text-xs text-right">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 text-slate-700">راتب أيام العمل الفعلية ({s.workedDays} يوم)</td>
                        <td className="p-3 font-mono font-bold text-slate-900 text-left dir-ltr">{formatCurrency(s.earnedSalary)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">ساعات العمل الإضافي ({s.overtimeHours} س)</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(s.overtimeAmount)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">مكافأة نهاية الخدمة المعتمدة</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(s.severanceAmount)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">بدل رصيد الإجازات المستحقة ({s.leaveEncashmentDays || 0} يوم)</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(s.leaveEncashment)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">مكافآت وإضافات وتسويات أخرى</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 text-left dir-ltr">+{formatCurrency(s.otherAdditions)} د.ل</td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-emerald-100 font-bold border-t border-emerald-200">
                      <tr>
                        <td className="p-3 text-emerald-950 font-black">إجمالي المستحقات:</td>
                        <td className="p-3 font-mono font-black text-emerald-950 text-left dir-ltr">
                          {formatCurrency(s.earnedSalary + s.overtimeAmount + s.severanceAmount + s.leaveEncashment + s.otherAdditions)} د.ل
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* الخصومات والالتزامات */}
                <div className="border border-red-300 rounded-xl overflow-hidden">
                  <div className="bg-red-50 text-red-950 font-black text-sm px-4 py-2 border-b border-red-200">
                    الاستقطاعات والالتزامات المسددة (-)
                  </div>
                  <table className="w-full text-xs text-right">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 text-slate-700">خصم التأخير والغياب</td>
                        <td className="p-3 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(s.lateDeduction)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">باقي السلفيات والعهد المالية غير المسددة</td>
                        <td className="p-3 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(s.advancesDeduction)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">خصومات إدارية / جزاءات / تلفيات</td>
                        <td className="p-3 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(s.disciplinaryDeduction)} د.ل</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700">استقطاعات أخرى</td>
                        <td className="p-3 font-mono font-bold text-red-700 text-left dir-ltr">-{formatCurrency(s.otherDeductions)} د.ل</td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-red-100 font-bold border-t border-red-200">
                      <tr>
                        <td className="p-3 text-red-950 font-black">إجمالي الاستقطاعات:</td>
                        <td className="p-3 font-mono font-black text-red-950 text-left dir-ltr">
                          -{formatCurrency(s.lateDeduction + s.advancesDeduction + s.disciplinaryDeduction + s.otherDeductions)} د.ل
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Net Settlement Banner */}
              <div className="bg-slate-900 text-white rounded-xl p-4 mb-6 flex justify-between items-center">
                <div>
                  <div className="text-xs text-slate-300 font-bold">صافي مبلغ التصفية والمخالصة النهائية المعتمد للصرف:</div>
                  <div className="text-sm text-amber-300 font-bold mt-1">
                    فقط: {numberToArabicWords(s.netSettlement)} دينار ليبي لا غير.
                  </div>
                </div>
                <div className="text-3xl font-black font-mono text-emerald-400 dir-ltr">
                  {formatCurrency(s.netSettlement)} <span className="text-sm font-sans text-slate-300">د.ل</span>
                </div>
              </div>

              {/* Legal Clearance Declaration */}
              <div className="border-2 border-dashed border-slate-400 bg-slate-50/70 rounded-xl p-4 mb-8 text-xs text-slate-800 leading-relaxed">
                <div className="font-black text-slate-900 mb-1 text-sm underline">إقرار وتعهد ومخالصة إبراء ذمة شاملة ومطلقة:</div>
                <p>
                  أقر أنا الموقع أدناه / <strong className="text-slate-900">{s.employeeName}</strong>، الحامل لبطاقة وظيفية رقم (<strong className="font-mono">{s.badgeNumber || '-'}</strong>)،
                  بأنني قد استلمت كامل مستحقاتي المالية العمالية والنظامية وبدل الإجازات ومكافأة نهاية الخدمة الموضحة أعلاه والبالغ قدرها (<strong className="font-mono dir-ltr">{formatCurrency(s.netSettlement)} د.ل</strong>) كاملة غير منقوصة،
                  وعليه فإنني أبرئ ذمة الشركة وإدارتها إبراءً عاماً وشاملاً ونهائياً ومطلقاً لا رجعة فيه من أي حق أو أجر أو مكافأة أو تعويض ناشئ عن علاقة العمل السابقة، وأقر بأنني قمت بتسليم كامل العهد والممتلكات الخاصة بالشركة دون استثناء.
                </p>
              </div>

              {/* Official Signatures Row */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t-2 border-slate-300 text-center break-inside-avoid">
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">الموظف المقر بما فيه</div>
                  <div className="h-16 border-b border-dashed border-slate-400 flex flex-col justify-end text-[10px] text-slate-400 pb-1">
                    الاسم والتوقيع والبصمة
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-1">{s.employeeName}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">مسؤول الموارد البشرية</div>
                  <div className="h-16 border-b border-dashed border-slate-400"></div>
                  <div className="text-xs font-bold text-slate-700 mt-1">التدقيق والاعتماد</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">المحاسب المالي</div>
                  <div className="h-16 border-b border-dashed border-slate-400"></div>
                  <div className="text-xs font-bold text-slate-700 mt-1">تأكيد الصرف والتسوية</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">اعتماد المدير العام</div>
                  <div className="h-16 border-b border-dashed border-slate-400 flex items-center justify-center">
                    {currentUser?.signature && (
                      <img src={currentUser.signature} alt="توقيع" className="max-h-12 object-contain" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-1">الختم والاعتماد الرسمي</div>
                </div>
              </div>
            </PrintPageWrapper>
          );
        })()}

        {printData.type === 'HR_OVERTIME_DAILY' && (() => {
          const { date, dayInfo, periods, stats, printedBy, generatedAt } = printData.data;
          const dayNameAr = dayInfo?.dayName || new Date(date + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'long' });
          return (
            <PrintPageWrapper id="hr-overtime-sheet" title={`كشف بيان واعتماد العمل الإضافي: ${date}`}>
              <PrintCompanyHeader className="pb-3 mb-4" />

              {/* Header Title & Date Banner */}
              <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">كشف بيان واعتماد ساعات العمل الإضافي اليومية</h1>
                  <div className="text-sm font-bold text-slate-600 mt-1 flex items-center gap-2">
                    <span>تاريخ اليوم:</span>
                    <span className="font-mono text-slate-900 text-base">{date}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-purple-900 font-bold">({dayNameAr})</span>
                    {dayInfo?.isWeekend && (
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">عطلة أسبوعية</span>
                    )}
                  </div>
                </div>
                <div className="text-left text-xs text-slate-500 font-mono" dir="ltr">
                  <div>Generated: {new Date(generatedAt).toLocaleDateString('ar-LY')}</div>
                  <div>User: {printedBy}</div>
                </div>
              </div>

              {/* Statistics Strip */}
              <div className="grid grid-cols-5 gap-3 mb-6 text-center">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-500">إجمالي الفترات</div>
                  <div className="text-xl font-black font-mono text-slate-800 mt-1">{stats?.totalPeriods || periods.length}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-blue-700">إجمالي الساعات المرصودة</div>
                  <div className="text-xl font-black font-mono text-blue-900 mt-1">{Number(stats?.totalHours || 0).toFixed(1)} س</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-purple-700">التكلفة المالية المقدرة</div>
                  <div className="text-xl font-black font-mono text-purple-900 mt-1 dir-ltr">{formatCurrency(stats?.totalAmount || 0)} د.ل</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-emerald-700">المعتمد (مقبول)</div>
                  <div className="text-xl font-black font-mono text-emerald-800 mt-1">
                    {stats?.approvedCount || 0} فترة ({Number(stats?.approvedHours || 0).toFixed(1)} س)
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-red-700">المرفوض (مستبعد)</div>
                  <div className="text-xl font-black font-mono text-red-800 mt-1">
                    {stats?.rejectedCount || 0} فترة ({Number(stats?.rejectedHours || 0).toFixed(1)} س)
                  </div>
                </div>
              </div>

              {/* Overtime Periods Table */}
              <table className="w-full text-right text-xs border-collapse border border-slate-400 mb-6">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400">
                  <tr>
                    <th className="p-2 border border-slate-300 w-8 text-center">#</th>
                    <th className="p-2 border border-slate-300 w-12 text-center">كود</th>
                    <th className="p-2 border border-slate-300">اسم الموظف</th>
                    <th className="p-2 border border-slate-300">القسم والوظيفة</th>
                    <th className="p-2 border border-slate-300">فترة الإضافي ونوعها</th>
                    <th className="p-2 border border-slate-300 text-center">نطاق البصمة المسجل</th>
                    <th className="p-2 border border-slate-300 text-center">الساعات</th>
                    <th className="p-2 border border-slate-300 text-center">معامل الإضافي</th>
                    <th className="p-2 border border-slate-300 text-center font-bold">الحسبة المالية (س × سعر)</th>
                    <th className="p-2 border border-slate-300 text-center">الحالة</th>
                    <th className="p-2 border border-slate-300">سبب الرفض / الملاحظات</th>
                    <th className="p-2 border border-slate-300 text-center w-24">التوقيع</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p: any, idx: number) => {
                    const empName = p.employee?.name || p.employeeName;
                    const badge = p.employee?.badgeNumber || p.badgeNumber || '-';
                    const dept = p.employee?.deptName || '-';
                    const job = p.employee?.jobTitle || '-';
                    const isRejected = p.status === 'rejected';
                    const isApproved = p.status === 'approved';

                    return (
                      <tr key={p.id || idx} className={`border-b border-slate-300 ${isRejected ? 'bg-red-50/50' : isApproved ? 'bg-emerald-50/30' : ''}`}>
                        <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-bold">{badge}</td>
                        <td className="p-2 border border-slate-300 font-bold text-slate-900">{empName}</td>
                        <td className="p-2 border border-slate-300 text-slate-700">{dept} - {job}</td>
                        <td className="p-2 border border-slate-300">
                          <span className="font-bold text-slate-800">{p.periodLabel}</span>
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono text-[11px] text-slate-600">{p.punchRange}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-bold">{p.hours} س</td>
                        <td className="p-2 border border-slate-300 text-center font-mono text-[11px] dir-ltr">{formatCurrency(p.overtimeRate)} د.ل/س</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-black text-purple-900 dir-ltr">
                          {p.hours} س × {formatCurrency(p.overtimeRate)} = {formatCurrency(p.amount)} د.ل
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-bold">
                          {isApproved && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">معتمد ✓</span>}
                          {isRejected && <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded text-[11px]">مرفوض ✗</span>}
                          {!isApproved && !isRejected && <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">معلق</span>}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-600 text-[11px]">
                          {isRejected ? (
                            <span className="text-red-800 font-bold">{p.rejectionReason || 'مستبعد من الاعتماد'}</span>
                          ) : (
                            p.reason || p.notes || '-'
                          )}
                        </td>
                        <td className="p-2 border border-slate-300"></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-200 font-black border-t-2 border-slate-500 text-slate-900">
                  <tr>
                    <td colSpan={6} className="p-2.5 text-right font-black">إجمالي الساعات المعتمدة للصرف اليوم:</td>
                    <td className="p-2.5 text-center font-mono text-emerald-900">{Number(stats?.approvedHours || 0).toFixed(1)} س</td>
                    <td></td>
                    <td className="p-2.5 text-center font-mono text-emerald-900 text-sm dir-ltr">
                      +{formatCurrency(stats?.approvedAmount || 0)} د.ل
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>

              {/* Official Signatures Row */}
              <div className="grid grid-cols-3 gap-6 pt-6 mt-6 border-t-2 border-slate-300 text-center break-inside-avoid">
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">إعداد مسؤول الموارد البشرية</div>
                  <div className="h-16 border-b border-dashed border-slate-400"></div>
                  <div className="text-xs font-bold text-slate-700 mt-2">مسؤول الموارد البشرية</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">مشرف الوردية / المسؤول المباشر</div>
                  <div className="h-16 border-b border-dashed border-slate-400"></div>
                  <div className="text-xs font-bold text-slate-700 mt-2">التوقيع والتأشير</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">اعتماد الصرف (المدير العام)</div>
                  <div className="h-16 border-b border-dashed border-slate-400 flex items-center justify-center">
                    {currentUser?.signature && (
                      <img src={currentUser.signature} alt="توقيع" className="max-h-14 object-contain" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-2">الختم والاعتماد الرسمي</div>
                </div>
              </div>
            </PrintPageWrapper>
          );
        })()}
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
      {syncErrorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-6 py-3 rounded-lg shadow-2xl z-[110] flex items-center gap-3 w-11/12 md:w-auto border border-amber-400">
          <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />
          <div className="font-bold text-sm md:text-base">{syncErrorMessage}</div>
          <button onClick={() => setSyncErrorMessage(null)} className="mr-auto hover:bg-amber-700 p-1 rounded-full"><X className="w-4 h-4"/></button>
        </div>
      )}
      {!isElectron() && serverOnline === false && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2.5 px-4 text-xs md:text-sm font-bold z-[100] flex flex-wrap items-center justify-center gap-3 shadow-lg">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>انقطع الاتصال بالخادم الرئيسي ({API_BASE_URL})! لحماية الأرقام والبيانات، تم إيقاف إصدار أرقام جديدة مؤقتاً لحين عودة الاتصال.</span>
          <button onClick={() => checkServerHealth().then(ok => setServerOnline(ok))} className="bg-white text-red-700 px-3 py-1 rounded text-xs font-bold hover:bg-red-50 transition-colors shadow-sm">إعادة المحاولة الآن</button>
        </div>
      )}
      {!isElectron() && serverOnline === true && (
        <div className="fixed bottom-4 left-4 bg-emerald-700/90 text-white text-xs px-3 py-1.5 rounded-full z-40 flex items-center gap-1.5 shadow-lg backdrop-blur">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse inline-block"/>
          متصل بالخادم الرئيسي
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white z-30 flex items-center justify-between px-4 shadow-lg">
        <h1 className="text-lg font-black flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-blue-500" /> شمس للأعمال المعدنية</h1>
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
          <h1 className="text-lg font-black text-white flex items-center gap-2.5"><LayoutDashboard className="w-6 h-6 text-blue-500 flex-shrink-0" /> شمس للأعمال المعدنية</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Main Operational Navigation */}
          <div className="space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم', permitted: hasPermission('dashboard', 'view') },
              { id: 'estimates', icon: FileText, label: 'التقديرات والعروض', permitted: hasPermission('estimates', 'view') || hasPermission('estimateCategories', 'view') },
              { id: 'workOrders', icon: Factory, label: 'أوامر التصنيع', permitted: hasPermission('workOrders', 'view') },
              { id: 'invoices', icon: Archive, label: 'سجل الصادر', permitted: hasPermission('invoices', 'view') },
              { id: 'purchases', icon: ShoppingBag, label: 'المشتريات والتوريد', permitted: hasPermission('purchases', 'view') || hasPermission('suppliers', 'view') },
              { id: 'customers', icon: Users, label: 'العملاء والسائقون', permitted: hasPermission('customers', 'view') || hasPermission('drivers', 'view') },
              { id: 'materials', icon: Package, label: 'المواد والأصناف', permitted: hasPermission('materials', 'view') || hasPermission('worksOf', 'view') },
              { id: 'hr', icon: UserCheck, label: 'الموارد البشرية', permitted: hasPermission('hr', 'view') },
              { id: 'reports', icon: BarChart3, label: 'التقارير والأداء', permitted: hasPermission('reports', 'view') },
            ]
              .filter(item => item.permitted)
              .map(item => {
                const badgeCount = getNewCount(item.id);
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'hr') {
                        setHrRefreshKey(prev => prev + 1);
                      }
                      setActiveTab(item.id);
                      setIsSidebarOpen(false);
                      window.scrollTo(0, 0);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${
                      isActive ? 'bg-blue-600 text-white shadow-md font-bold' : 'hover:bg-slate-800 hover:text-white text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {badgeCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center animate-in zoom-in">
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Admin System Management Section */}
          {(() => {
            const adminItems = [
              { id: 'auditLog', icon: ShieldCheck, label: 'سجل حركات النظام', permitted: hasPermission('auditLog', 'view') },
              { id: 'users', icon: UserCog, label: 'إدارة المستخدمين', permitted: hasPermission('users', 'view') },
              { id: 'settings', icon: Settings, label: 'الإعدادات العامة', permitted: hasPermission('settings', 'view') },
            ].filter(item => item.permitted);

            if (adminItems.length === 0) return null;

            return (
              <div className="pt-4">
                <div className="px-3 pb-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">إدارة النظام</span>
                  <div className="flex-1 h-px bg-slate-800/80" />
                </div>
                <div className="space-y-1">
                  {adminItems.map(item => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); window.scrollTo(0, 0); }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${
                          isActive ? 'bg-blue-600 text-white shadow-md font-bold' : 'hover:bg-slate-800 hover:text-white text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
            <ErrorBoundary>
              <>
                {/* 1. Dashboard */}
                {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}

              {/* 2. Estimates & Categories */}
              {activeTab === 'estimates' && viewState !== 'calculator' && (
                <div>
                  <SubTabNav
                    tabs={[
                      ...(hasPermission('estimates', 'view') ? [{ id: 'estimates', label: 'عروض الأسعار والتقديرات', icon: FileText, count: estimates?.length }] : []),
                      ...(hasPermission('estimateCategories', 'view') ? [{ id: 'categories', label: 'تصنيفات التقديرات', icon: Tags, count: estimateCategories?.length }] : [])
                    ]}
                    activeTab={!hasPermission('estimates', 'view') ? 'categories' : estimatesSubTab}
                    onChange={(id) => setEstimatesSubTab(id as any)}
                    title="التقديرات والعروض"
                    description="إدارة عروض الأسعار والتصنيفات"
                  />
                  {(!hasPermission('estimates', 'view') || estimatesSubTab === 'categories') && hasPermission('estimateCategories', 'view') ? (
                    <EstimateCategoriesView />
                  ) : (
                    <EstimatesView setViewState={setViewState} setActiveTab={setActiveTab} setTabStates={setTabStates} setEditingInvoice={setEditingInvoice} />
                  )}
                </div>
              )}
              {(activeTab === 'estimates' || activeTab === 'workOrders') && viewState === 'calculator' && <CostCalculatorView setViewState={setViewState} />}

              {/* 3. Work Orders */}
              {activeTab === 'workOrders' && viewState !== 'calculator' && <WorkOrdersView setViewState={setViewState} setEditingInvoice={setEditingInvoice} setActiveTab={setActiveTab} setTabStates={setTabStates} />}

              {/* 4. Invoices */}
              {activeTab === 'invoices' && viewState !== 'edit_invoice' && <OutboundLogView setEditingInvoice={setEditingInvoice} setActiveTab={setActiveTab} setViewState={setViewState} />}
              {activeTab === 'invoices' && viewState === 'edit_invoice' && editingInvoice && <InvoiceEditorView editingInvoice={editingInvoice} setEditingInvoice={setEditingInvoice} setViewState={setViewState} setActiveTab={setActiveTab} />}

              {/* 5. Purchases & Suppliers */}
              {activeTab === 'purchases' && (
                <div>
                  <SubTabNav
                    tabs={[
                      ...(hasPermission('purchases', 'view') ? [{ id: 'invoices', label: 'فواتير المشتريات', icon: ShoppingBag, count: purchaseInvoices?.length }] : []),
                      ...(hasPermission('suppliers', 'view') ? [{ id: 'suppliers', label: 'دليل الموردين', icon: Building2, count: suppliers?.length }] : [])
                    ]}
                    activeTab={!hasPermission('purchases', 'view') ? 'suppliers' : purchasesSubTab}
                    onChange={(id) => setPurchasesSubTab(id as any)}
                    title="المشتريات والتوريد"
                    description="سجل فواتير المشتريات ودليل الموردين والشركات"
                  />
                  {(!hasPermission('purchases', 'view') || purchasesSubTab === 'suppliers') && hasPermission('suppliers', 'view') ? (
                    <SuppliersView
                      onViewSupplierInvoices={(supplierIdOrName: string) => {
                        setPurchasesSupplierFilter(supplierIdOrName);
                        setPurchasesSubTab('invoices');
                        window.scrollTo(0, 0);
                      }}
                    />
                  ) : (
                    <PurchasesView
                      initialSupplierFilter={purchasesSupplierFilter}
                      onClearSupplierFilter={() => setPurchasesSupplierFilter('')}
                    />
                  )}
                </div>
              )}

              {/* 6. Customers & Drivers */}
              {activeTab === 'customers' && (
                <div>
                  <SubTabNav
                    tabs={[
                      ...(hasPermission('customers', 'view') ? [{ id: 'customers', label: 'دليل العملاء', icon: Users, count: customers?.length }] : []),
                      ...(hasPermission('drivers', 'view') ? [{ id: 'drivers', label: 'سجل السائقين والسيارات', icon: Truck, count: drivers?.length }] : [])
                    ]}
                    activeTab={!hasPermission('customers', 'view') ? 'drivers' : customersSubTab}
                    onChange={(id) => setCustomersSubTab(id as any)}
                    title="العملاء والنقل"
                    description="دليل العملاء وبيانات السائقين ووسائل النقل"
                  />
                  {(!hasPermission('customers', 'view') || customersSubTab === 'drivers') && hasPermission('drivers', 'view') ? (
                    <DriversView />
                  ) : (
                    <CustomersView />
                  )}
                </div>
              )}

              {/* 7. Materials & Works */}
              {activeTab === 'materials' && viewState !== 'edit_invoice' && (
                <div>
                  <SubTabNav
                    tabs={[
                      ...(hasPermission('materials', 'view') ? [{ id: 'materials', label: 'قائمة المواد والتسعير', icon: Package, count: masterMaterials?.length }] : []),
                      ...(hasPermission('worksOf', 'view') ? [{ id: 'worksOf', label: 'أنواع الأعمال والبنود الرئيسية', icon: Layers, count: worksOf?.length }] : [])
                    ]}
                    activeTab={!hasPermission('materials', 'view') ? 'worksOf' : materialsSubTab}
                    onChange={(id) => setMaterialsSubTab(id as any)}
                    title="المواد والأصناف"
                    description="تسعير المواد وتهيئة أقسام وبنود الأعمال"
                  />
                  {(!hasPermission('materials', 'view') || materialsSubTab === 'worksOf') && hasPermission('worksOf', 'view') ? (
                    <WorksOfView selectedWorkId={selectedWorkId} setSelectedWorkId={setSelectedWorkId} />
                  ) : (
                    <MaterialsView setActiveTab={setActiveTab} setViewState={setViewState} setEditingInvoice={setEditingInvoice} />
                  )}
                </div>
              )}
              {activeTab === 'materials' && viewState === 'edit_invoice' && editingInvoice && <InvoiceEditorView editingInvoice={editingInvoice} setEditingInvoice={setEditingInvoice} setViewState={setViewState} setActiveTab={setActiveTab} />}

              {/* 7. Human Resources (HR) */}
              {activeTab === 'hr' && <HRView refreshKey={hrRefreshKey} />}

              {/* 8. Reports & Performance Analytics */}
              {activeTab === 'reports' && <ReportsView setActiveTab={setActiveTab} printStats={printStats} />}

              {/* 9. Admin: Settings, Users, AuditLog */}
              {activeTab === 'settings' && <SettingsView />}
              {activeTab === 'users' && <UsersView />}
              {activeTab === 'auditLog' && <AuditLogView />}
            </>
            </ErrorBoundary>
          )}
        </div>
      </main>
    </div>
  );
}

