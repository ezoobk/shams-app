import React, { useState, useMemo } from 'react';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useInvoices } from '../../context/InvoicesContext';
import { useCustomers } from '../../context/CustomersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { useLetters } from '../../context/LettersContext';
import { usePurchases } from '../../context/PurchasesContext';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import { useAuditLog } from '../../context/AuditLogContext';
import {
  LayoutDashboard,
  Factory,
  FileText,
  Users,
  Truck,
  FileCheck2,
  Mail,
  Check,
  Table as TableIcon,
  LayoutGrid,
  Calendar,
  ChevronLeft,
  Search,
  ShoppingBag,
  Calculator,
  X,
  Archive,
  Coins,
  UserCheck,
  Clock,
  ArrowRightLeft,
  DollarSign,
  Settings,
  UserX,
  ShieldAlert,
  PlusCircle,
  CheckCircle2,
  Activity,
  RefreshCw,
  Trash2,
  AlertCircle,
  Edit
} from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';

interface RecentActivityItem {
  id: string;
  date: string;
  type: string;
  category: 'workOrders' | 'invoices' | 'purchases' | 'shipping' | 'letters' | 'estimates';
  title: string;
  details?: string;
  data: any;
  tab: string;
  subTab?: string;
}

interface WorkOrderMovement {
  id: string;
  timestamp: string;
  actionCategory: 'create' | 'status_change' | 'sale' | 'shipping' | 'delete' | 'other';
  actionLabel: string;
  badgeClass: string;
  icon: any;
  title: string;
  details?: string;
  userName?: string;
  entityId?: string;
  rawData?: any;
}

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  setEditingInvoice?: (inv: any) => void;
  setViewState?: (state: string, targetTab?: string) => void;
  setTabStates?: React.Dispatch<React.SetStateAction<any>>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  setEditingInvoice,
  setViewState,
  setTabStates
}) => {
  const { workOrders } = useWorkOrders();
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { estimates } = useEstimates();
  const { shippingOrders } = useShippingOrders();
  const { letters } = useLetters();
  const { purchaseInvoices } = usePurchases();
  const { employees, shifts, attendanceLogs, transactions, payrollRecords, syncStats, analyzeDayAttendance } = useHR();
  const { hasPermission, currentUser } = useAuth();
  const { logs } = useAuditLog();

  // Granular dashboard permissions
  const canQaEstimates = hasPermission('dashboard', 'qa_estimates');
  const canQaFinalInvoices = hasPermission('dashboard', 'qa_final_invoices');
  const canQaWorkOrders = hasPermission('dashboard', 'qa_work_orders');
  const canQaShipping = hasPermission('dashboard', 'qa_shipping');
  const canQaLetters = hasPermission('dashboard', 'qa_letters');
  const hasAnyQuickAction = canQaEstimates || canQaFinalInvoices || canQaWorkOrders || canQaShipping || canQaLetters;

  const canViewStats = hasPermission('dashboard', 'view_stats');
  const canViewInvoicesSummary = hasPermission('dashboard', 'view_invoices_summary');
  const canViewPurchasesSummary = hasPermission('dashboard', 'view_purchases_summary');
  const hasAnyFinancialSummary = canViewInvoicesSummary || canViewPurchasesSummary;

  const canViewWOMovements = hasPermission('dashboard', 'view_wo_movements');
  const canViewHRCard = hasPermission('dashboard', 'view_hr_card');
  const canViewHRShortcuts = hasPermission('dashboard', 'view_hr_shortcuts');

  const canViewRecentActivity = hasPermission('dashboard', 'view_recent_activity');

  const hasAnyVisibleSection = hasAnyQuickAction || canViewStats || hasAnyFinancialSummary || canViewWOMovements || canViewHRCard || canViewRecentActivity;

  // View mode state (Table vs Cards) with localStorage persistence
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const saved = localStorage.getItem('shams_dashboard_view_mode');
      return saved === 'cards' ? 'cards' : 'table';
    } catch {
      return 'table';
    }
  });

  const handleSetViewMode = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem('shams_dashboard_view_mode', mode);
    } catch {}
  };

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(12);

  const getItemStatus = (item: any) => {
    const mfgStatus = item.mfgStatus || item.status || 'قيد التصنيع';
    const saleStatus = item.status === 'مباع' ? 'مباعة' : 'غير مباعة';
    return { mfgStatus, saleStatus };
  };

  const activeWorkOrdersCount = workOrders
    .flatMap(wo => wo.items || [])
    .filter(i => getItemStatus(i).mfgStatus !== 'جاهز').length;

  const currentYear = new Date().getFullYear();

  // Helper to extract year from entity or date string
  const getEntityYear = (item: any): number => {
    if (!item) return currentYear;
    const candidates = [
      item.date,
      item.createdAt,
      item.invoiceDate,
      item.lastUpdated,
      ...(Array.isArray(item.items) ? item.items.map((i: any) => i?.date || i?.createdAt || i?.lastUpdated) : [])
    ].filter(Boolean);

    for (const d of candidates) {
      const s = String(d).trim();
      if (!s) continue;
      const yyyyMatch = s.match(/^(\d{4})/);
      if (yyyyMatch) {
        const y = parseInt(yyyyMatch[1], 10);
        if (y >= 2000 && y <= 2100) return y;
      }
      const endYyyyMatch = s.match(/(\d{4})$/);
      if (endYyyyMatch) {
        const y = parseInt(endYyyyMatch[1], 10);
        if (y >= 2000 && y <= 2100) return y;
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        if (y >= 2000 && y <= 2100) return y;
      }
    }
    return currentYear;
  };

  const readyWorkOrdersCount = workOrders
    .flatMap(wo => wo.items || [])
    .filter(i => getItemStatus(i).mfgStatus === 'جاهز' && getItemStatus(i).saleStatus === 'غير مباعة').length;

  // Final Invoices (الفواتير النهائية لهذا العام) calculations & navigation
  const finalInvoices = useMemo(() => {
    return (invoices || []).filter(inv => {
      if (!inv || inv.type !== 'نهائية') return false;
      return getEntityYear(inv) === currentYear;
    });
  }, [invoices, currentYear]);

  const finalInvoicesCount = finalInvoices.length;

  const allFinalInvoicesCount = useMemo(() => {
    return (invoices || []).filter(inv => inv && inv.type === 'نهائية').length;
  }, [invoices]);

  const finalInvoicesTotalAmount = useMemo(() => {
    return finalInvoices.reduce((sum, inv) => {
      const val = Number(inv?.netTotal ?? inv?.total ?? inv?.totalAmount ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [finalInvoices]);

  const preliminaryInvoicesCount = useMemo(() => {
    return (invoices || []).filter(inv => inv && inv.type === 'مبدئية').length;
  }, [invoices]);

  const averageFinalInvoiceAmount = finalInvoicesCount > 0 ? (finalInvoicesTotalAmount / finalInvoicesCount) : 0;

  const handleGoToInvoicesArchive = (filter: 'نهائية' | 'الكل' = 'نهائية') => {
    try {
      window.localStorage.setItem('shams_outbound_tab', JSON.stringify('invoices'));
      window.localStorage.setItem('shams_outbound_filterType', JSON.stringify(filter));
    } catch {}
    setActiveTab('invoices');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Purchases (فواتير المشتريات لهذا العام) calculations & navigation
  const thisYearPurchaseInvoices = useMemo(() => {
    return (purchaseInvoices || []).filter(inv => {
      if (!inv) return false;
      return getEntityYear(inv) === currentYear;
    });
  }, [purchaseInvoices, currentYear]);

  const purchaseInvoicesCount = thisYearPurchaseInvoices.length;

  const allPurchaseInvoicesCount = (purchaseInvoices || []).length;

  const totalPurchasesSum = useMemo(() => {
    return thisYearPurchaseInvoices.reduce((sum, inv) => {
      const val = Number(inv?.netTotal ?? inv?.total ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [thisYearPurchaseInvoices]);

  const handleGoToPurchases = () => {
    try {
      window.localStorage.setItem('shams_purchases_subtab', JSON.stringify('invoices'));
    } catch {}
    setActiveTab('purchases');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // HR metrics and navigation
  const activeEmployeesCount = useMemo(() => {
    return (employees || []).filter(e => e.isActive !== false).length;
  }, [employees]);

  // Analyzed list of attendance for all active employees for today
  const todayDailyAnalysis = useMemo(() => {
    if (!analyzeDayAttendance) return [];
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    return (employees || [])
      .filter(e => e.isActive !== false)
      .map(emp => analyzeDayAttendance(todayStr, emp));
  }, [employees, attendanceLogs, analyzeDayAttendance]);

  const todayStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    let singlePunch = 0;

    todayDailyAnalysis.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'late') { present++; late++; }
      else if (r.status === 'single_punch') { present++; singlePunch++; }
      else if (r.status === 'leave') leave++;
      else if (r.status === 'absent') absent++;
    });

    return {
      total: todayDailyAnalysis.length,
      present,
      late,
      absent,
      leave,
      singlePunch
    };
  }, [todayDailyAnalysis]);

  const handleGoToHR = (tab: string = 'attendance') => {
    try {
      window.localStorage.setItem('shams_hr_tab', JSON.stringify(tab));
      window.localStorage.removeItem('shams_hr_attendance_statusFilter');
    } catch {}
    setActiveTab('hr');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToAttendance = (statusFilter?: string) => {
    try {
      window.localStorage.setItem('shams_hr_tab', JSON.stringify('attendance'));
      if (statusFilter) {
        window.localStorage.setItem('shams_hr_attendance_statusFilter', JSON.stringify(statusFilter));
      } else {
        window.localStorage.removeItem('shams_hr_attendance_statusFilter');
      }
    } catch {}
    setActiveTab('hr');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build unified recent activities across all modules
  const allActivities: RecentActivityItem[] = useMemo(() => {
    const list: RecentActivityItem[] = [
      ...workOrders.map(wo => ({
        id: wo.id,
        date: wo.date,
        type: 'أمر تصنيع',
        category: 'workOrders' as const,
        title: wo.customerName || 'عام',
        details: wo.items?.length ? `${wo.items.length} منتجات` : undefined,
        data: wo,
        tab: 'workOrders'
      })),
      ...invoices.map(inv => ({
        id: inv.id,
        date: inv.date,
        type: inv.type === 'مبدئية' ? 'فاتورة مبدئية' : 'فاتورة نهائية',
        category: 'invoices' as const,
        title: inv.customerName || 'عميل نقدي',
        details: inv.netTotal ? `${formatCurrency(inv.netTotal)} د.ل` : undefined,
        data: inv,
        tab: 'invoices',
        subTab: 'invoices'
      })),
      ...purchaseInvoices.map(pinv => ({
        id: pinv.id,
        date: pinv.date,
        type: 'فاتورة مشتريات',
        category: 'purchases' as const,
        title: pinv.supplierName || 'مورد غير محدد',
        details: pinv.netTotal ? `${formatCurrency(pinv.netTotal)} د.ل` : undefined,
        data: pinv,
        tab: 'purchases'
      })),
      ...shippingOrders.map(so => ({
        id: so.id,
        date: so.date,
        type: 'أمر نقل',
        category: 'shipping' as const,
        title: so.destination || 'بدون وجهة',
        details: (so as any).driverName ? `السائق: ${(so as any).driverName}` : undefined,
        data: so,
        tab: 'invoices',
        subTab: 'shipping'
      })),
      ...letters.map(ltr => ({
        id: ltr.id,
        date: ltr.date,
        type: 'مراسلة',
        category: 'letters' as const,
        title: (ltr.to ? `${ltr.to} - ` : '') + (ltr.subject || 'مراسلة إدارية'),
        details: ltr.subject || undefined,
        data: ltr,
        tab: 'invoices',
        subTab: 'letters'
      })),
      ...estimates.map(est => ({
        id: est.id,
        date: est.date,
        type: 'تقدير سعر',
        category: 'estimates' as const,
        title: est.desc || 'تقدير كلفة',
        details: est.sellPrice ? `${formatCurrency(est.sellPrice)} د.ل` : undefined,
        data: est,
        tab: 'estimates'
      }))
    ];

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workOrders, invoices, purchaseInvoices, shippingOrders, letters, estimates]);

  // Filtered activity list
  const filteredActivities = useMemo(() => {
    let result = allActivities;

    if (selectedCategory !== 'all') {
      result = result.filter(item => {
        if (selectedCategory === 'invoices') return item.type === 'فاتورة نهائية' || item.type === 'فاتورة مبدئية';
        if (selectedCategory === 'workOrders') return item.type === 'أمر تصنيع';
        if (selectedCategory === 'purchases') return item.type === 'فاتورة مشتريات';
        if (selectedCategory === 'letters') return item.type === 'مراسلة';
        if (selectedCategory === 'shipping') return item.type === 'أمر نقل';
        if (selectedCategory === 'estimates') return item.type === 'تقدير سعر';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item =>
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.details && item.details.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allActivities, selectedCategory, searchQuery]);

  const displayedActivities = useMemo(() => {
    return filteredActivities.slice(0, displayLimit);
  }, [filteredActivities, displayLimit]);

  // Formatting date safely
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Visual configuration for each activity type
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'أمر تصنيع':
        return {
          label: 'أمر تصنيع',
          icon: Factory,
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
          gradientBar: 'from-blue-500 to-indigo-500',
          hoverBg: 'hover:bg-blue-50/40'
        };
      case 'فاتورة مبدئية':
        return {
          label: 'فاتورة مبدئية',
          icon: FileText,
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          gradientBar: 'from-amber-500 to-orange-500',
          hoverBg: 'hover:bg-amber-50/40'
        };
      case 'فاتورة نهائية':
        return {
          label: 'فاتورة نهائية',
          icon: FileCheck2,
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          gradientBar: 'from-emerald-500 to-teal-500',
          hoverBg: 'hover:bg-emerald-50/40'
        };
      case 'فاتورة مشتريات':
        return {
          label: 'فاتورة مشتريات',
          icon: ShoppingBag,
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          gradientBar: 'from-indigo-500 to-violet-500',
          hoverBg: 'hover:bg-indigo-50/40'
        };
      case 'أمر نقل':
        return {
          label: 'أمر نقل',
          icon: Truck,
          badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          gradientBar: 'from-cyan-500 to-sky-500',
          hoverBg: 'hover:bg-cyan-50/40'
        };
      case 'مراسلة':
        return {
          label: 'مراسلة',
          icon: Mail,
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          gradientBar: 'from-purple-500 to-pink-500',
          hoverBg: 'hover:bg-purple-50/40'
        };
      case 'تقدير سعر':
        return {
          label: 'تقدير سعر',
          icon: Calculator,
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
          gradientBar: 'from-sky-500 to-blue-500',
          hoverBg: 'hover:bg-sky-50/40'
        };
      default:
        return {
          label: type,
          icon: FileText,
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
          gradientBar: 'from-slate-400 to-slate-500',
          hoverBg: 'hover:bg-slate-50/40'
        };
    }
  };

  // Navigation handler
  const handleNavigate = (activity: RecentActivityItem) => {
    if (activity.subTab) {
      window.localStorage.setItem('shams_outbound_tab', JSON.stringify(activity.subTab));
    }
    setActiveTab(activity.tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Direct Invoice Editor handler for preliminary & final invoices
  const handleCreateInvoice = (type: 'مبدئية' | 'نهائية') => {
    const newInvoice = {
      isDraft: true,
      type: type,
      customerName: '',
      items: [],
      total: 0,
      discount: 0,
      netTotal: 0,
      notes: '',
      terms: '',
      sourceTab: 'dashboard',
      createdBy: currentUser ? {
        id: currentUser.id,
        name: currentUser.displayName,
        jobTitle: currentUser.jobTitle || 'مدير مبيعات',
        signature: currentUser.signature || '',
        stamp: currentUser.stamp || ''
      } : undefined
    };

    if (setEditingInvoice) {
      setEditingInvoice(newInvoice);
    }
    if (setViewState) {
      setViewState('edit_invoice');
    }
    if (setTabStates) {
      setTabStates((prev: any) => ({ ...prev, dashboard: 'edit_invoice' }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper for human-readable relative time
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} س`;
      if (diffDays === 1) return 'أمس';
      if (diffDays < 7) return `منذ ${diffDays} أيام`;
      return d.toLocaleDateString('ar-LY', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Click handler for a Work Order movement item
  const handleMovementClick = (movement: WorkOrderMovement) => {
    if (movement.actionCategory === 'shipping') {
      try {
        window.localStorage.setItem('shams_outbound_tab', JSON.stringify('shipping'));
      } catch {}
      setActiveTab('invoices');
    } else if (movement.actionCategory === 'sale') {
      try {
        window.localStorage.setItem('shams_outbound_tab', JSON.stringify('invoices'));
      } catch {}
      setActiveTab('invoices');
    } else {
      setActiveTab('workOrders');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to extract a work order item's total cost
  const getWorkOrderItemCost = (item: any): number => {
    if (!item) return 0;
    if (item.totalCost !== undefined && item.totalCost !== null && !isNaN(Number(item.totalCost)) && Number(item.totalCost) > 0) {
      return Number(item.totalCost);
    }
    if (Array.isArray(item.materials) && item.materials.length > 0) {
      const matSum = item.materials.reduce((sum: number, mat: any) => sum + (Number(mat.qty || 0) * Number(mat.price || 0)), 0);
      if (matSum > 0) return matSum;
    }
    if (item.cost !== undefined && item.cost !== null && !isNaN(Number(item.cost)) && Number(item.cost) > 0) {
      return Number(item.cost);
    }
    if (item.totalCost !== undefined && item.totalCost !== null && !isNaN(Number(item.totalCost))) {
      return Number(item.totalCost);
    }
    if (item.estimateId || item.id) {
      const est = (estimates || []).find((e: any) => e && (e.id === item.estimateId || e.id === item.id));
      if (est && est.totalCost && !isNaN(Number(est.totalCost)) && Number(est.totalCost) > 0) {
        return Number(est.totalCost);
      }
    }
    return 0;
  };

  // Helper to extract a full work order's total cost
  const getWorkOrderCost = (wo: any): number => {
    if (!wo) return 0;
    let itemsSum = 0;
    if (Array.isArray(wo.items) && wo.items.length > 0) {
      itemsSum = wo.items.reduce((sum: number, item: any) => sum + getWorkOrderItemCost(item), 0);
    }
    if (itemsSum > 0) return itemsSum;
    if (wo.totalCost !== undefined && wo.totalCost !== null && !isNaN(Number(wo.totalCost)) && Number(wo.totalCost) > 0) {
      return Number(wo.totalCost);
    }
    if (wo.cost !== undefined && wo.cost !== null && !isNaN(Number(wo.cost)) && Number(wo.cost) > 0) {
      return Number(wo.cost);
    }
    return 0;
  };

  // Work orders filtered for the current year
  const thisYearWorkOrders = useMemo(() => {
    return (workOrders || []).filter(wo => getEntityYear(wo) === currentYear);
  }, [workOrders, currentYear]);

  // Total production cost for this year
  const thisYearWOTotalCost = useMemo(() => {
    return thisYearWorkOrders.reduce((total, wo) => total + getWorkOrderCost(wo), 0);
  }, [thisYearWorkOrders, estimates]);

  // Total items manufactured in this year's work orders
  const thisYearWOItemsCount = useMemo(() => {
    return thisYearWorkOrders.reduce((total, wo) => total + (Array.isArray(wo.items) ? wo.items.length : 0), 0);
  }, [thisYearWorkOrders]);

  // Build the unified last 5 movements for Work Orders
  const latestWOMovements = useMemo(() => {
    const movements: WorkOrderMovement[] = [];
    const seenKeys = new Set<string>();

    // 1. Audit Logs (high fidelity with user display name, timestamp, and specific title)
    (logs || []).forEach(log => {
      const isWO = log.entityType === 'أوامر التصنيع' || log.targetCollection === 'work_orders';
      const isShipping = log.entityType === 'أوامر النقل' || log.targetCollection === 'shipping_orders';
      const isFinalInvoiceSale = (log.entityType === 'فواتير المبيعات' || log.targetCollection === 'invoices') &&
        (log.title?.includes('نهائية') || log.details?.includes('SN') || log.details?.includes('نهائية'));

      if (!isWO && !isShipping && !isFinalInvoiceSale) return;

      let actionCategory: WorkOrderMovement['actionCategory'] = 'other';
      let actionLabel = 'حركة تصنيع';
      let badgeClass = 'bg-slate-50 text-slate-700 border-slate-200';
      let icon = Factory;

      if (isWO) {
        if (log.actionType === 'create') {
          actionCategory = 'create';
          actionLabel = 'إنشاء أمر تصنيع';
          badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
          icon = PlusCircle;
        } else if (log.actionType === 'status_change') {
          actionCategory = 'status_change';
          const isReady = log.title?.includes('جاهز') || log.details?.includes('جاهز');
          actionLabel = isReady ? 'جاهز للبيع' : 'قيد التصنيع';
          badgeClass = isReady ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200';
          icon = isReady ? CheckCircle2 : RefreshCw;
        } else if (log.actionType === 'delete') {
          actionCategory = 'delete';
          actionLabel = 'إلغاء أمر تصنيع';
          badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
          icon = Trash2;
        } else {
          actionCategory = 'other';
          actionLabel = 'تعديل أمر تصنيع';
          badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
          icon = Edit;
        }
      } else if (isShipping) {
        actionCategory = 'shipping';
        actionLabel = log.actionType === 'delete' ? 'إلغاء نقل منتج' : 'أمر نقل وشحن';
        badgeClass = log.actionType === 'delete' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200';
        icon = Truck;
      } else if (isFinalInvoiceSale) {
        actionCategory = 'sale';
        actionLabel = 'بيع واعتماد منتج';
        badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
        icon = FileCheck2;
      }

      const key = `${log.entityId || log.title}-${log.actionType}-${(log.timestamp || '').slice(0, 16)}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      movements.push({
        id: log.id,
        timestamp: log.timestamp || new Date().toISOString(),
        actionCategory,
        actionLabel,
        badgeClass,
        icon,
        title: log.title || 'حركة في خط الإنتاج',
        details: log.details,
        userName: log.userDisplayName || log.userName,
        entityId: log.entityId,
        rawData: log
      });
    });

    // 2. Synthesize/supplement from live entities
    // A) Work orders creation & items ready
    (workOrders || []).forEach(wo => {
      const woKey = `wo-create-${wo.id}`;
      if (!seenKeys.has(woKey)) {
        seenKeys.add(woKey);
        movements.push({
          id: woKey,
          timestamp: wo.date || new Date().toISOString(),
          actionCategory: 'create',
          actionLabel: 'إنشاء أمر تصنيع',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: PlusCircle,
          title: `أمر تصنيع: ${wo.customerName || 'عميل عام'}`,
          details: wo.items?.length ? `يتضمن ${wo.items.length} منتجات (${wo.items.map(i => i.desc).slice(0, 2).join('، ')})` : undefined,
          entityId: wo.id,
          rawData: wo
        });
      }

      (wo.items || []).forEach(item => {
        const itemDate = item.lastUpdated || item.date || wo.date;
        if (item.mfgStatus === 'جاهز' || item.status === 'جاهز') {
          const itemKey = `wo-item-ready-${item.serialNumber}`;
          if (!seenKeys.has(itemKey)) {
            seenKeys.add(itemKey);
            movements.push({
              id: itemKey,
              timestamp: itemDate || new Date().toISOString(),
              actionCategory: 'status_change',
              actionLabel: 'جاهز للبيع',
              badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              icon: CheckCircle2,
              title: `اكتمال تصنيع: ${item.desc || 'منتج جاهز'}`,
              details: `الرقم التسلسلي: ${item.serialNumber || '--'} | أمر تصنيع: ${wo.id}`,
              entityId: item.serialNumber,
              rawData: item
            });
          }
        }
      });
    });

    // B) Shipping orders
    (shippingOrders || []).forEach(so => {
      const soKey = `so-ship-${so.id}`;
      if (!seenKeys.has(soKey)) {
        seenKeys.add(soKey);
        movements.push({
          id: soKey,
          timestamp: so.date || new Date().toISOString(),
          actionCategory: 'shipping',
          actionLabel: 'أمر نقل وشحن',
          badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          icon: Truck,
          title: `أمر نقل إلى: ${so.destination || 'وجهة التسليم'}`,
          details: `السائق: ${(so as any).driver?.name || (so as any).driverName || '--'} | عدد البنود: ${so.items?.length || 0}`,
          entityId: so.id,
          rawData: so
        });
      }
    });

    // C) Final Invoices (sales)
    (finalInvoices || []).forEach(inv => {
      const invKey = `inv-sale-${inv.id}`;
      if (!seenKeys.has(invKey)) {
        seenKeys.add(invKey);
        movements.push({
          id: invKey,
          timestamp: inv.date || new Date().toISOString(),
          actionCategory: 'sale',
          actionLabel: 'بيع واعتماد منتج',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: FileCheck2,
          title: `فاتورة بيع نهائية: ${inv.customerName || 'عميل'}`,
          details: `رقم الفاتورة: ${inv.id} | القيمة: ${inv.netTotal ? formatCurrency(inv.netTotal) : '--'} د.ل`,
          entityId: inv.id,
          rawData: inv
        });
      }
    });

    // Sort descending by timestamp
    movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Slice last 5
    return movements.slice(0, 5);
  }, [logs, workOrders, shippingOrders, finalInvoices]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <h1 className="text-3xl font-black text-slate-800">لوحة التحكم</h1>

      {/* Quick Actions */}
      {hasAnyQuickAction && (
        <div className="flex flex-wrap gap-4">
          {canQaEstimates && (
            <button
              onClick={() => handleCreateInvoice('مبدئية')}
              className="flex-1 min-w-[180px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-indigo-600 cursor-pointer"
            >
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-center">إنشاء فاتورة مبدئية</span>
            </button>
          )}

          {canQaFinalInvoices && (
            <button
              onClick={() => handleCreateInvoice('نهائية')}
              className="flex-1 min-w-[180px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-emerald-600 cursor-pointer"
            >
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-center">إنشاء فاتورة نهائية</span>
            </button>
          )}

          {canQaWorkOrders && (
            <button
              onClick={() => { setActiveTab('estimates'); window.scrollTo(0, 0); }}
              className="flex-1 min-w-[180px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-blue-600 cursor-pointer"
            >
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                <Factory className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-center">إنشاء أمر تصنيع</span>
            </button>
          )}

          {canQaShipping && (
            <button
              onClick={() => {
                window.localStorage.setItem('wo_filterMfg', JSON.stringify('جاهز'));
                window.localStorage.setItem('wo_filterSale', JSON.stringify('مباع'));
                window.localStorage.setItem('wo_filterShipping', JSON.stringify('غير منقولة'));
                setActiveTab('workOrders');
                window.scrollTo(0, 0);
              }}
              className="flex-1 min-w-[180px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-orange-600 cursor-pointer"
            >
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-center">إنشاء أمر نقل</span>
            </button>
          )}

          {canQaLetters && (
            <button
              onClick={() => {
                window.localStorage.setItem('shams_outbound_tab', JSON.stringify('letters'));
                window.localStorage.setItem('shams_letters_create', JSON.stringify(true));
                setActiveTab('invoices');
                window.scrollTo(0, 0);
              }}
              className="flex-1 min-w-[180px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-purple-600 cursor-pointer"
            >
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-center">إنشاء مراسلة</span>
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {canViewStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-slate-300 text-sm font-bold mb-1">قيد التصنيع</div>
              <div className="text-4xl font-black">{activeWorkOrdersCount} <span className="text-sm font-normal">منتج</span></div>
            </div>
            <Factory className="absolute -left-4 -bottom-4 w-24 h-24 text-slate-700 opacity-50" />
          </div>

          <div className="bg-emerald-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-emerald-200 text-sm font-bold mb-1">جاهز للبيع</div>
              <div className="text-4xl font-black">{readyWorkOrdersCount} <span className="text-sm font-normal">منتج</span></div>
            </div>
            <Check className="absolute -left-4 -bottom-4 w-24 h-24 text-emerald-800 opacity-30" />
          </div>

          <div className="bg-indigo-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-indigo-200 text-sm font-bold mb-1">إجمالي الفواتير</div>
              <div className="text-4xl font-black">{invoices.length}</div>
            </div>
            <FileText className="absolute -left-4 -bottom-4 w-24 h-24 text-indigo-800 opacity-30" />
          </div>

          <div className="bg-orange-500 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-orange-200 text-sm font-bold mb-1">إجمالي العملاء</div>
              <div className="text-4xl font-black">{customers.length}</div>
            </div>
            <Users className="absolute -left-4 -bottom-4 w-24 h-24 text-orange-700 opacity-30" />
          </div>
        </div>
      )}

      {/* قسم إجماليات الفواتير النهائية والمشتريات */}
      {hasAnyFinancialSummary && (
        <div className={`grid grid-cols-1 ${canViewInvoicesSummary && canViewPurchasesSummary ? 'lg:grid-cols-2' : ''} gap-4`}>
          {/* بطاقة الفواتير النهائية (المبيعات) */}
          {canViewInvoicesSummary && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-800 text-base">إجمالي الفواتير النهائية</h2>
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          عام {currentYear}
                        </span>
                        <span className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                          معتمدة
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">فواتير المبيعات الصادرة والمعتمدة بالسجل الصادر لعام {currentYear}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGoToInvoicesArchive('نهائية')}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>أرشيف الفواتير</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1">عدد الفواتير ({currentYear})</div>
                      <div className="text-2xl font-black text-slate-800">
                        {finalInvoicesCount} <span className="text-xs font-normal text-slate-500">فاتورة ({allFinalInvoicesCount} الإجمالي)</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-white text-emerald-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1">المجموع الكلي ({currentYear})</div>
                      <div className="text-2xl font-black text-emerald-600 font-mono dir-ltr">
                        {formatCurrency(finalInvoicesTotalAmount)} <span className="text-xs font-bold text-slate-600 dir-rtl">د.ل</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-white text-emerald-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <Coins className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              {finalInvoicesTotalAmount > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="truncate" title={numberToArabicWords(finalInvoicesTotalAmount)}>
                    <span className="text-slate-400">المبلغ بالحروف ({currentYear}):</span> <span className="font-bold text-slate-700">{numberToArabicWords(finalInvoicesTotalAmount)} دينار ليبي</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* بطاقة فواتير المشتريات */}
          {canViewPurchasesSummary && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-800 text-base">إجمالي فواتير المشتريات</h2>
                        <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                          عام {currentYear}
                        </span>
                        <span className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                          المشتريات والتوريد
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">فواتير شراء المواد والمصروفات المسجلة من الموردين لعام {currentYear}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleGoToPurchases}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>سجل المشتريات</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1">عدد الفواتير ({currentYear})</div>
                      <div className="text-2xl font-black text-slate-800">
                        {purchaseInvoicesCount} <span className="text-xs font-normal text-slate-500">فاتورة ({allPurchaseInvoicesCount} الإجمالي)</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-white text-indigo-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1">إجمالي المشتريات ({currentYear})</div>
                      <div className="text-2xl font-black text-indigo-600 font-mono dir-ltr">
                        {formatCurrency(totalPurchasesSum)} <span className="text-xs font-bold text-slate-600 dir-rtl">د.ل</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-white text-indigo-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <Coins className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              {totalPurchasesSum > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="truncate" title={numberToArabicWords(totalPurchasesSum)}>
                    <span className="text-slate-400">المبلغ بالحروف ({currentYear}):</span> <span className="font-bold text-slate-700">{numberToArabicWords(totalPurchasesSum)} دينار ليبي</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* اختصار آخر خمس حركات في أوامر التصنيع */}
      {canViewWOMovements && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-800 text-base">أوامر التصنيع والإنتاج</h2>
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    عام {currentYear}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">إجمالي تكاليف التصنيع للعام الحالي ومتابعة أحدث الحركات على خط الإنتاج</p>
              </div>
            </div>

            <button
              onClick={() => { setActiveTab('workOrders'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Factory className="w-3.5 h-3.5" />
              <span>سجل أوامر التصنيع</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* مؤشرات التكلفة وأوامر التصنيع لهذا العام */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3.5">
            {/* بطاقة إجمالي التكلفة هذا العام */}
            <div
              onClick={() => { setActiveTab('workOrders'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="bg-slate-50 hover:bg-indigo-50/40 p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors flex items-center justify-between cursor-pointer group"
              title="عرض أوامر التصنيع"
            >
              <div>
                <div className="text-xs font-bold text-slate-500 group-hover:text-indigo-700 transition-colors mb-1">
                  إجمالي التكلفة هذا العام ({currentYear})
                </div>
                <div className="text-2xl font-black text-indigo-600 font-mono dir-ltr">
                  {formatCurrency(thisYearWOTotalCost)} <span className="text-xs font-bold text-slate-600 dir-rtl">د.ل</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white group-hover:bg-indigo-100 text-indigo-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm transition-colors">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* بطاقة عدد أوامر التصنيع لهذا العام */}
            <div
              onClick={() => { setActiveTab('workOrders'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="bg-slate-50 hover:bg-slate-100/70 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between cursor-pointer group"
              title="عرض أوامر التصنيع"
            >
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">أوامر التصنيع (عام {currentYear})</div>
                <div className="text-2xl font-black text-slate-800">
                  {thisYearWorkOrders.length} <span className="text-xs font-normal text-slate-500">أمر ({thisYearWOItemsCount} قطعة)</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Factory className="w-5 h-5" />
              </div>
            </div>

            {/* بطاقة قيد الإنتاج حالياً */}
            <div
              onClick={() => { setActiveTab('workOrders'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="bg-slate-50 hover:bg-amber-50/50 p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors flex items-center justify-between cursor-pointer group"
              title="عرض أوامر التصنيع النشطة"
            >
              <div>
                <div className="text-xs font-bold text-slate-500 group-hover:text-amber-700 transition-colors mb-1">
                  قيد الإنتاج حالياً
                </div>
                <div className="text-2xl font-black text-amber-600">
                  {activeWorkOrdersCount} <span className="text-xs font-normal text-slate-500">أمر نشط ({readyWorkOrdersCount} جاهز)</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white group-hover:bg-amber-100 text-amber-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm transition-colors">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* المبلغ بالحروف للتكلفة */}
          {thisYearWOTotalCost > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="truncate" title={numberToArabicWords(thisYearWOTotalCost)}>
                <span className="text-slate-400">إجمالي التكلفة بالحروف ({currentYear}):</span> <span className="font-bold text-slate-700">{numberToArabicWords(thisYearWOTotalCost)} دينار ليبي</span>
              </div>
            </div>
          )}

          {/* قسم آخر 5 حركات */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <h3 className="font-bold text-slate-700 text-xs sm:text-sm">آخر حركات أوامر التصنيع</h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                آخر 5 حركات
              </span>
            </div>
            <span className="text-[11px] text-slate-400">تحديث لحظي لخط الإنتاج</span>
          </div>

          {/* قائمة آخر 5 حركات */}
          <div className="pt-2.5 space-y-2.5">
            {latestWOMovements.length > 0 ? (
              latestWOMovements.map((movement, idx) => {
                const IconComponent = movement.icon;
                return (
                  <div
                    key={`${movement.id}-${idx}`}
                    onClick={() => handleMovementClick(movement)}
                    className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${movement.badgeClass}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${movement.badgeClass}`}>
                            {movement.actionLabel}
                          </span>
                          {movement.entityId && (
                            <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 dir-ltr">
                              {movement.entityId}
                            </span>
                          )}
                          {movement.userName && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              بواسطة: <span className="text-slate-600 font-bold">{movement.userName}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-slate-800 truncate" title={movement.title}>
                          {movement.title}
                        </div>

                        {movement.details && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={movement.details}>
                            {movement.details}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 text-xs">
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatTimeAgo(movement.timestamp)}</span>
                      </span>
                      <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-0.5 transition-colors">
                        <span>عرض التفاصيل</span>
                        <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Factory className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">لا توجد حركات مسجلة في أوامر التصنيع حتى الآن.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* بطاقة اختصار الموارد البشرية */}
      {canViewHRCard && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-800 text-base">الموارد البشرية وشؤون الموظفين</h2>
                  <span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    HR & البصمة
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">متابعة الحضور والانصراف، الموظفين، السلفيات، ومسير الرواتب</p>
              </div>
            </div>

            {hasPermission('hr', 'view') && (
              <button
                onClick={() => handleGoToHR('attendance')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>قسم الموارد البشرية</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* مؤشرات الأداء السريعة للموارد البشرية */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3.5">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">الموظفون المسجلون</div>
                <div className="text-xl sm:text-2xl font-black text-slate-800">
                  {activeEmployeesCount} <span className="text-xs font-normal text-slate-400">نشط ({employees.length})</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white text-blue-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => handleGoToAttendance('present')}
              title="عرض الحاضرين اليوم"
              className="bg-slate-50 hover:bg-emerald-50/60 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors flex items-center justify-between cursor-pointer group"
            >
              <div>
                <div className="text-xs font-bold text-slate-500 group-hover:text-emerald-700 transition-colors mb-1">حضور اليوم</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600">
                  {todayStats.present} <span className="text-xs font-normal text-slate-500">حاضر</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white group-hover:bg-emerald-100 text-emerald-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm transition-colors">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => handleGoToAttendance('absent')}
              title="عرض الغائبين اليوم"
              className="bg-slate-50 hover:bg-rose-50/60 p-3.5 rounded-xl border border-slate-200 hover:border-rose-300 transition-colors flex items-center justify-between cursor-pointer group"
            >
              <div>
                <div className="text-xs font-bold text-slate-500 group-hover:text-rose-700 transition-colors mb-1">غياب اليوم</div>
                <div className="text-xl sm:text-2xl font-black text-rose-600">
                  {todayStats.absent} <span className="text-xs font-normal text-slate-500">غائب</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white group-hover:bg-rose-100 text-rose-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm transition-colors">
                <UserX className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">جداول العمل والورديات</div>
                <div className="text-xl sm:text-2xl font-black text-indigo-600">
                  {shifts.length} <span className="text-xs font-normal text-slate-500">وردية</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white text-indigo-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between col-span-2 sm:col-span-1">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">السلفيات والعمليات</div>
                <div className="text-xl sm:text-2xl font-black text-amber-600">
                  {transactions.length} <span className="text-xs font-normal text-slate-500">حركة</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white text-amber-600 rounded-lg border border-slate-200 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* أزرار الاختصارات السريعة المباشرة لأقسام الموارد البشرية */}
          {canViewHRShortcuts && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 ml-1">اختصارات سريعة:</span>
              
              <button
                onClick={() => handleGoToAttendance()}
                className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>سجل الحضور اليومي</span>
              </button>

              <button
                onClick={() => handleGoToAttendance('absent')}
                className="px-3 py-1.5 bg-rose-50/80 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5 text-rose-600" />
                <span>سجل الغياب اليومي</span>
                {todayStats.absent > 0 && (
                  <span className="bg-rose-200 text-rose-800 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                    {todayStats.absent}
                  </span>
                )}
              </button>

              {hasPermission('hr', 'view') && (
                <button
                  onClick={() => handleGoToHR('employees')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>دليل الموظفين</span>
                </button>
              )}

              {hasPermission('hr', 'view') && (
                <button
                  onClick={() => handleGoToHR('transactions')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  <span>السلفيات والخصومات</span>
                </button>
              )}

              {hasPermission('hr', 'payroll') && (
                <button
                  onClick={() => handleGoToHR('payroll')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>مسير الرواتب</span>
                </button>
              )}

              {hasPermission('hr', 'view') && (
                <button
                  onClick={() => handleGoToHR('reports')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>التقارير وبطاقة الحضور</span>
                </button>
              )}

              {hasPermission('hr', 'sync') && (
                <button
                  onClick={() => handleGoToHR('zk_settings')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  <span>إعدادات البصمة ZKTeco</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Section */}
      {canViewRecentActivity && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Section Header with Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          {/* Title & Stats */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                أحدث السجلات والملفات المنشأة
                <span className="text-xs font-semibold bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-full">
                  {filteredActivities.length} سجل
                </span>
              </h2>
              <p className="text-xs text-slate-500">سجل النشاطات والملفات المنشأة مؤخراً في كافة أقسام النظام</p>
            </div>
          </div>

          {/* Action Bar: Search, Category Filter, View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالرقم أو البيان..."
                className="text-xs pr-9 pl-7 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-44 md:w-52"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل الأقسام</option>
              <option value="invoices">فواتير مبيعات</option>
              <option value="workOrders">أوامر تصنيع</option>
              <option value="purchases">فواتير مشتريات</option>
              <option value="letters">مراسلات</option>
              <option value="shipping">أوامر نقل</option>
              <option value="estimates">تقديرات كلفة</option>
            </select>

            {/* Toggle: Table vs Cards */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleSetViewMode('table')}
                title="عرض الجدول"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>جدول</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetViewMode('cards')}
                title="عرض البطاقات"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>بطاقات</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Table View (عرض بشكل كامل دون أي تمرير أفقي) */}
        {viewMode === 'table' && (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-right text-sm border-collapse">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[32%]" />
                <col className="w-[32%]" />
                <col className="w-[14%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th className="py-3 px-4 text-right">نوع السجل</th>
                  <th className="py-3 px-4 text-right">الرقم الإشاري / المعرف</th>
                  <th className="py-3 px-4 text-right">البيان / العميل / الموضوع</th>
                  <th className="py-3 px-4 text-right">التاريخ</th>
                  <th className="py-3 px-4 text-center">فتح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedActivities.map((activity, idx) => {
                  const conf = getTypeConfig(activity.type);
                  const IconComponent = conf.icon;
                  return (
                    <tr
                      key={`${activity.id}-${idx}`}
                      onClick={() => handleNavigate(activity)}
                      className="hover:bg-indigo-50/40 transition-colors duration-150 cursor-pointer group"
                    >
                      {/* Type Column */}
                      <td className="py-3.5 px-4 align-top">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${conf.badgeClass}`}>
                          <IconComponent className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{conf.label}</span>
                        </span>
                      </td>

                      {/* Reference/ID Column */}
                      <td className="py-3.5 px-4 align-top font-mono font-bold text-xs text-slate-900 break-words break-all [overflow-wrap:anywhere] leading-relaxed">
                        <span className="group-hover:text-indigo-600 transition-colors">
                          {activity.id}
                        </span>
                      </td>

                      {/* Title / Subject Column */}
                      <td className="py-3.5 px-4 align-top text-slate-700 break-words break-all [overflow-wrap:anywhere] leading-relaxed">
                        <div className="font-semibold text-slate-800 text-xs md:text-sm">
                          {activity.title}
                        </div>
                        {activity.details && (
                          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                            {activity.details}
                          </div>
                        )}
                      </td>

                      {/* Date Column */}
                      <td className="py-3.5 px-4 align-top text-xs text-slate-500 font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200/60">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          {formatDate(activity.date)}
                        </span>
                      </td>

                      {/* Action / Arrow Column */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="w-7 h-7 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                          <ChevronLeft className="w-4 h-4 -translate-x-0 group-hover:-translate-x-0.5 transition-transform" />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {displayedActivities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <LayoutDashboard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">لا توجد سجلات مطابقة للبحث أو التصفية.</p>
                      {searchQuery && (
                        <button
                          onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                          className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                        >
                          إعادة ضبط التصفية
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* View Mode 2: Cards View (عرض البطاقات التفاعلية) */}
        {viewMode === 'cards' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5 bg-slate-50/50">
              {displayedActivities.map((activity, idx) => {
                const conf = getTypeConfig(activity.type);
                const IconComponent = conf.icon;
                return (
                  <div
                    key={`${activity.id}-${idx}`}
                    onClick={() => handleNavigate(activity)}
                    className="bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Top colored accent line */}
                    <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r ${conf.gradientBar}`} />

                    <div>
                      {/* Top Row: Type Badge + Date */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${conf.badgeClass}`}>
                          <IconComponent className="w-3.5 h-3.5 shrink-0" />
                          <span>{conf.label}</span>
                        </span>

                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDate(activity.date)}
                        </span>
                      </div>

                      {/* Reference / ID Block */}
                      <div className="font-mono text-xs font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 break-words break-all [overflow-wrap:anywhere] leading-relaxed group-hover:bg-indigo-50/50 group-hover:border-indigo-200 transition-colors">
                        {activity.id}
                      </div>

                      {/* Title / Customer */}
                      <div className="mt-3">
                        <div className="text-[11px] text-slate-400 font-medium mb-0.5">البيان / العميل:</div>
                        <div className="text-sm font-bold text-slate-800 break-words break-all [overflow-wrap:anywhere] leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                          {activity.title}
                        </div>
                      </div>

                      {/* Details (if any) */}
                      {activity.details && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                          <span className="truncate">{activity.details}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer: Action hint */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                      <span>فتح السجل</span>
                      <ChevronLeft className="w-4 h-4 -translate-x-0 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>

            {displayedActivities.length === 0 && (
              <div className="py-16 text-center text-slate-400">
                <LayoutDashboard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-sm">لا توجد سجلات مطابقة للبحث أو التصفية.</p>
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                    className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                  >
                    إعادة ضبط التصفية
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Load More Footer (if more items available) */}
        {filteredActivities.length > displayLimit && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
            <button
              onClick={() => setDisplayLimit(prev => prev + 12)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              عرض المزيد من السجلات ({filteredActivities.length - displayLimit} سجل إضافي)
              <ChevronLeft className="w-3.5 h-3.5 rotate-270" />
            </button>
          </div>
        )}
      </div>
      )}

      {/* حالة لوحة التحكم الفارغة إذا لم يتم تخصيص أي بطاقات أو اختصارات للمستخدم */}
      {!hasAnyVisibleSection && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">لوحة التحكم فارغة</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            لم يتم تفعيل بطاقات معلومات أو أزرار اختصارات لحسابك في لوحة التحكم بعد. يمكنك استخدام القائمة الجانبية للتنقل بين الأقسام المصرح لك بها.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-200">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>لتعديل الصلاحيات والبطاقات المعروضة، يرجى التواصل مع مدير النظام</span>
          </div>
        </div>
      )}
    </div>
  );
};