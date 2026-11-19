import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  ShieldCheck, 
  Search, 
  Download, 
  Trash2, 
  User, 
  PlusCircle, 
  Edit3, 
  Printer, 
  RefreshCw, 
  Clock, 
  Calendar, 
  Eye, 
  X, 
  AlertCircle, 
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { useAuditLog, type AuditLogEntry, type AuditActionType } from '../../context/AuditLogContext';
import { useAuth } from '../../context/AuthContext';

export const AuditLogView: React.FC = () => {
  const { logs, isLoading, clearLogs, revertAction } = useAuditLog();
  const { users, currentUser } = useAuth();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Modals
  const [inspectLog, setInspectLog] = useState<AuditLogEntry | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearOption, setClearOption] = useState<'30' | '90' | 'all'>('30');
  const [clearConfirmText, setClearConfirmText] = useState('');

  // Revert (Undo) state
  const [revertingLog, setRevertingLog] = useState<AuditLogEntry | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [revertFeedback, setRevertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canRevert = (log: AuditLogEntry) => {
    if (log.isReverted) return false;
    if (!log.targetCollection) return false;
    if (!['create', 'edit', 'delete', 'status_change'].includes(log.actionType)) return false;
    return true;
  };

  // Extract unique entities for filter dropdown
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.entityType) set.add(l.entityType);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Extract unique users
  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => {
      if (l.userId && l.userDisplayName) {
        map.set(l.userId, l.userDisplayName);
      }
    });
    // Add existing registered users as well
    users.forEach(u => {
      map.set(u.id, u.displayName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs, users]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = (log.title || '').toLowerCase().includes(q);
        const matchesDetails = (log.details || '').toLowerCase().includes(q);
        const matchesId = (log.entityId || '').toLowerCase().includes(q);
        const matchesUser = (log.userDisplayName || '').toLowerCase().includes(q) || (log.userName || '').toLowerCase().includes(q);
        const matchesEntity = (log.entityType || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDetails && !matchesId && !matchesUser && !matchesEntity) {
          return false;
        }
      }

      // 2. Action Type
      if (selectedAction !== 'all') {
        if (selectedAction === 'reverted') {
          if (!log.isReverted) return false;
        } else if (log.actionType !== selectedAction) {
          return false;
        }
      }

      // 3. User
      if (selectedUser !== 'all') {
        if (log.userId !== selectedUser && log.userName !== selectedUser) return false;
      }

      // 4. Entity
      if (selectedEntity !== 'all') {
        if (log.entityType !== selectedEntity) return false;
      }

      // 5. Date filter
      if (dateFilter !== 'all') {
        const logDate = new Date(log.timestamp);
        const now = new Date();

        if (dateFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (logDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (logDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [logs, searchQuery, selectedAction, selectedUser, selectedEntity, dateFilter, customStartDate, customEndDate]);

  // Stats counters
  const stats = useMemo(() => {
    let creates = 0;
    let edits = 0;
    let deletes = 0;
    let prints = 0;
    let reverted = 0;

    filteredLogs.forEach(l => {
      if (l.isReverted) reverted++;
      if (l.actionType === 'create') creates++;
      else if (l.actionType === 'edit') edits++;
      else if (l.actionType === 'delete') deletes++;
      else if (l.actionType === 'print') prints++;
    });

    return {
      total: filteredLogs.length,
      creates,
      edits,
      deletes,
      prints,
      reverted
    };
  }, [filteredLogs]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, currentPage, rowsPerPage]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedAction('all');
    setSelectedUser('all');
    setSelectedEntity('all');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
  };

  // Helper to format date and time in Arabic / Libyan format
  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { date: isoString, time: '' };
      const date = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const time = d.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      return { date, time };
    } catch {
      return { date: isoString, time: '' };
    }
  };

  // Action badge renderer
  const renderActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'create':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <PlusCircle className="w-3.5 h-3.5" /> إضافة
          </span>
        );
      case 'edit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Edit3 className="w-3.5 h-3.5" /> تعديل
          </span>
        );
      case 'delete':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </span>
        );
      case 'print':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Printer className="w-3.5 h-3.5" /> طباعة
          </span>
        );
      case 'status_change':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3.5 h-3.5" /> تغيير حالة
          </span>
        );
      case 'login':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <User className="w-3.5 h-3.5" /> تسجيل دخول
          </span>
        );
      case 'export':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Download className="w-3.5 h-3.5" /> تصدير
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      alert('لا توجد بيانات لتصديرها.');
      return;
    }

    const rows = filteredLogs.map((log, index) => {
      const { date, time } = formatDateTime(log.timestamp);
      let actionLabel: string = log.actionType;
      if (log.actionType === 'create') actionLabel = 'إضافة';
      else if (log.actionType === 'edit') actionLabel = 'تعديل';
      else if (log.actionType === 'delete') actionLabel = 'حذف';
      else if (log.actionType === 'print') actionLabel = 'طباعة';
      else if (log.actionType === 'status_change') actionLabel = 'تغيير حالة';
      else if (log.actionType === 'login') actionLabel = 'تسجيل دخول';
      else if (log.actionType === 'export') actionLabel = 'تصدير';

      return {
        '#': index + 1,
        'التاريخ': date,
        'الوقت': time,
        'المستخدم': log.userDisplayName || log.userName || '--',
        'اسم الحساب': log.userName ? `@${log.userName}` : '--',
        'الرتبة': log.userRole === 'admin' ? 'مدير' : 'مستخدم',
        'نوع العملية': actionLabel,
        'القسم / الكيان': log.entityType || '--',
        'الرقم المرجعي': log.entityId || '--',
        'بيان الحركة': log.title || '--',
        'التفاصيل': log.details || '--'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الحركات');
    XLSX.writeFile(workbook, `سجل_حركات_النظام_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
  };

  // Handle clear logs
  const handleConfirmClear = async () => {
    if (clearOption === 'all') {
      if (clearConfirmText.trim() !== 'تأكيد') {
        alert('يرجى كتابة كلمة (تأكيد) لتأكيد مسح كافة السجلات');
        return;
      }
      await clearLogs();
    } else if (clearOption === '30') {
      await clearLogs(30);
    } else if (clearOption === '90') {
      await clearLogs(90);
    }

    setShowClearModal(false);
    setClearConfirmText('');
  };

  // Handle revert action (Undo)
  const handleExecuteRevert = async () => {
    if (!revertingLog) return;
    setIsReverting(true);
    setRevertFeedback(null);

    try {
      const result = await revertAction(revertingLog.id);
      if (result.success) {
        setRevertFeedback({ type: 'success', message: result.message });
        setTimeout(() => {
          setRevertingLog(null);
          setRevertFeedback(null);
          if (inspectLog && inspectLog.id === revertingLog.id) {
            setInspectLog(null);
          }
        }, 1500);
      } else {
        setRevertFeedback({ type: 'error', message: result.message });
      }
    } catch (err: any) {
      setRevertFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تنفيذ عملية التراجع' });
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-800">سجل حركات النظام</h1>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                تدقيق ورقابة العمليات
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              متابعة وتدقيق حركات المستخدمين على النظام من إضافة وتعديل وحذف وطباعة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-xs transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
            title="تصدير السجل إلى Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm transition-colors"
              title="تنظيف السجلات القديمة"
            >
              <Trash2 className="w-4 h-4" />
              <span>تنظيف السجلات</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي الحركات</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800">{stats.total}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">حركة مسجلة مطابقة</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-800">عمليات الإضافة</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
              <PlusCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.creates}</div>
          <div className="text-[11px] text-emerald-600/70 font-medium mt-1">إنشاء مستندات وبنود</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-100 bg-blue-50/20 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-800">عمليات التعديل</span>
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
              <Edit3 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.edits}</div>
          <div className="text-[11px] text-blue-600/70 font-medium mt-1">تحديث بيانات وحالات</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-100 bg-red-50/20 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-800">عمليات الحذف</span>
            <span className="p-1.5 rounded-lg bg-red-100 text-red-600">
              <Trash2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-red-700">{stats.deletes}</div>
          <div className="text-[11px] text-red-600/70 font-medium mt-1">حذف سجلات ومستندات</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-100 bg-purple-50/20 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-800">عمليات الطباعة</span>
            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
              <Printer className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-purple-700">{stats.prints}</div>
          <div className="text-[11px] text-purple-600/70 font-medium mt-1">طباعة وتصدير أوامر</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-800">تم التراجع عنها</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <RotateCcw className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.reverted}</div>
          <div className="text-[11px] text-amber-600/80 font-medium mt-1">حركات ملغاة ومعكوسة</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <span>خيارات التصفية والبحث</span>
          </div>
          {(searchQuery || selectedAction !== 'all' || selectedUser !== 'all' || selectedEntity !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        {/* Row 1: Search and dropdown filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="بحث بالبيان، الكود، المستخدم..."
              className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
            />
          </div>

          {/* User Filter */}
          <div className="relative">
            <select
              value={selectedUser}
              onChange={e => { setSelectedUser(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm bg-white cursor-pointer font-medium text-slate-700"
            >
              <option value="all">جميع المستخدمين</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div className="relative">
            <select
              value={selectedEntity}
              onChange={e => { setSelectedEntity(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm bg-white cursor-pointer font-medium text-slate-700"
            >
              <option value="all">جميع الأقسام والموديولات</option>
              {entityOptions.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>

          {/* Date Presets Filter */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm bg-white cursor-pointer font-medium text-slate-700"
            >
              <option value="all">كافة الفترات الزمنية</option>
              <option value="today">اليوم فقط</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوماً</option>
              <option value="custom">نطاق زمني مخصص...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker (shown when 'custom' is selected) */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
            <span className="font-bold text-slate-600 flex items-center gap-1.5 text-xs">
              <Calendar className="w-4 h-4 text-slate-400" /> من تاريخ:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
              className="p-2 border border-slate-300 rounded-lg bg-white text-xs font-mono outline-none"
            />
            <span className="font-bold text-slate-600 text-xs">إلى تاريخ:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
              className="p-2 border border-slate-300 rounded-lg bg-white text-xs font-mono outline-none"
            />
          </div>
        )}

        {/* Action Type Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-xs font-bold text-slate-400 ml-1">نوع العملية:</span>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'create', label: 'إضافة (+)' },
            { id: 'edit', label: 'تعديل' },
            { id: 'delete', label: 'حذف' },
            { id: 'print', label: 'طباعة' },
            { id: 'status_change', label: 'تغيير حالة' },
            { id: 'login', label: 'تسجيل دخول' },
            { id: 'reverted', label: 'تم التراجع عنها ↺' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => { setSelectedAction(btn.id); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedAction === btn.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4 w-40">التاريخ والوقت</th>
                <th className="p-4 w-44">المستخدم</th>
                <th className="p-4 w-32">نوع العملية</th>
                <th className="p-4 w-36">القسم</th>
                <th className="p-4 w-36">الرقم المرجعي</th>
                <th className="p-4">بيان وتفاصيل الحركة</th>
                <th className="p-4 w-36 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>جارٍ تحميل سجل الحركات...</span>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">لا توجد حركات مسجلة تطابق شروط التصفية</p>
                    <p className="text-xs text-slate-400 mt-1">جرّب تغيير كلمات البحث أو إعادة ضبط الفلاتر</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const { date, time } = formatDateTime(log.timestamp);
                  const serialNum = (currentPage - 1) * rowsPerPage + index + 1;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectLog(log)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        log.isReverted ? 'bg-slate-50/40 opacity-75' : ''
                      }`}
                    >
                      {/* # */}
                      <td className="p-4 text-center font-mono text-xs text-slate-400 font-bold">
                        {serialNum}
                      </td>

                      {/* Date & Time */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-700 text-xs">{date}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{time}</div>
                      </td>

                      {/* User */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                            {(log.userDisplayName || log.userName || 'U').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-xs truncate max-w-[120px]" title={log.userDisplayName}>
                              {log.userDisplayName || log.userName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {log.userName ? `@${log.userName}` : '--'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action Type */}
                      <td className="p-4 whitespace-nowrap">
                        {renderActionBadge(log.actionType)}
                      </td>

                      {/* Entity Type */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded-md">
                          {log.entityType || '--'}
                        </span>
                      </td>

                      {/* Reference Code */}
                      <td className="p-4 whitespace-nowrap">
                        {log.entityId ? (
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50/70 border border-blue-100 px-2 py-0.5 rounded">
                            {log.entityId}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-mono">--</span>
                        )}
                      </td>

                      {/* Description & Details */}
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-xs mb-0.5 group-hover:text-blue-600 transition-colors">
                          {log.title}
                        </div>
                        {log.details && (
                          <div className="text-xs text-slate-500 line-clamp-1" title={log.details}>
                            {log.details}
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {log.isReverted ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 line-through"
                              title={`تم التراجع في: ${log.revertedAt ? formatDateTime(log.revertedAt).date + ' ' + formatDateTime(log.revertedAt).time : ''} بواسطة: ${log.revertedBy || ''}`}
                            >
                              <RotateCcw className="w-3 h-3 text-slate-400" />
                              تم التراجع
                            </span>
                          ) : (
                            currentUser?.role === 'admin' &&
                            canRevert(log) && (
                              <button
                                onClick={() => {
                                  setRevertFeedback(null);
                                  setRevertingLog(log);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors shadow-2xs"
                                title="التراجع عن هذه الحركة وإلغاء أثرها"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                تراجع
                              </button>
                            )
                          )}

                          <button
                            onClick={() => setInspectLog(log)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="عرض تفاصيل الحركة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredLogs.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span>
                عرض {((currentPage - 1) * rowsPerPage) + 1} إلى {Math.min(currentPage * rowsPerPage, filteredLogs.length)} من {filteredLogs.length} حركة
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">| سطور الصفحة:</span>
                <select
                  value={rowsPerPage}
                  onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  السابق
                </button>
                <div className="px-3 py-1 font-mono text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700">
                  {currentPage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inspect Log Modal */}
      {inspectLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">تفاصيل حركة النظام</h3>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm bg-white">
              {inspectLog.isReverted && (
                <div className="bg-slate-100 border border-slate-300 p-3.5 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم التراجع عن هذه الحركة وإلغاء أثرها في النظام</span>
                  </div>
                  <div className="text-slate-500 font-medium">
                    بواسطة: <span className="font-bold text-slate-700">{inspectLog.revertedBy || '--'}</span>
                    {inspectLog.revertedAt && (
                      <span className="font-mono mr-1">({formatDateTime(inspectLog.revertedAt).date})</span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-0.5">نوع العملية</span>
                  <div>{renderActionBadge(inspectLog.actionType)}</div>
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-0.5">القسم / الكيان</span>
                  <span className="font-bold text-slate-800 text-xs bg-white border border-slate-200 px-2 py-1 rounded inline-block">
                    {inspectLog.entityType || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-0.5">التاريخ والوقت</span>
                  <div className="font-mono text-xs font-bold text-slate-700">
                    {formatDateTime(inspectLog.timestamp).date} - {formatDateTime(inspectLog.timestamp).time}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-0.5">الرقم المرجعي</span>
                  <div className="font-mono text-xs font-bold text-blue-700">
                    {inspectLog.entityId || '--'}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">المستخدم المنفذ</span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center">
                    {(inspectLog.userDisplayName || inspectLog.userName || 'U').charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">
                      {inspectLog.userDisplayName || inspectLog.userName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {inspectLog.userName ? `@${inspectLog.userName}` : ''} ({inspectLog.userRole === 'admin' ? 'مدير نظام' : 'مستخدم'})
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">بيان الحركة</span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 text-sm">
                  {inspectLog.title}
                </div>
              </div>

              {inspectLog.details && (
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">التفاصيل الكاملة</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                    {inspectLog.details}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div>
                {!inspectLog.isReverted && currentUser?.role === 'admin' && canRevert(inspectLog) && (
                  <button
                    onClick={() => {
                      setRevertFeedback(null);
                      setRevertingLog(inspectLog);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>التراجع عن هذه الحركة</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Action Confirmation Modal (Admin Only) */}
      {revertingLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">تأكيد التراجع عن الحركة</h3>
              </div>
              <button
                onClick={() => { if (!isReverting) setRevertingLog(null); }}
                className="p-1 rounded-lg hover:bg-amber-800 text-amber-100 hover:text-white transition-colors"
                disabled={isReverting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {revertFeedback && (
                <div className={`p-4 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                  revertFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {revertFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>{revertFeedback.message}</div>
                </div>
              )}

              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>هل أنت متأكد من رغبتك في التراجع عن هذا الإجراء؟</span>
                </div>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  {revertingLog.actionType === 'create' && 'سيتم إلغاء وحذف السجل المضاف من قاعدة البيانات وإعادة النظام لحالته السابقة.'}
                  {revertingLog.actionType === 'edit' && 'سيتم التراجع عن التعديل واسترجاع القيم والبيانات السابقة المحفوظة.'}
                  {revertingLog.actionType === 'delete' && 'سيتم استرجاع السجل المحذوف وإعادة إدراجه في النظام.'}
                  {revertingLog.actionType === 'status_change' && 'سيتم إرجاع الحالة إلى ما كانت عليه قبل التغيير.'}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">بيان الحركة:</span>
                  <span className="font-bold text-slate-800 text-left line-clamp-1">{revertingLog.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">القسم / الكيان:</span>
                  <span className="font-bold text-slate-700">{revertingLog.entityType}</span>
                </div>
                {revertingLog.entityId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">الرقم المرجعي:</span>
                    <span className="font-mono font-bold text-blue-700">{revertingLog.entityId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">المنفذ الأصلي:</span>
                  <span className="font-bold text-slate-700">{revertingLog.userDisplayName || revertingLog.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">تاريخ الحركة:</span>
                  <span className="font-mono text-slate-600">{formatDateTime(revertingLog.timestamp).date} {formatDateTime(revertingLog.timestamp).time}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setRevertingLog(null)}
                disabled={isReverting}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold text-xs transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteRevert}
                disabled={isReverting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50"
              >
                {isReverting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ التراجع...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تأكيد التراجع</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Modal (Admin Only) */}
      {showClearModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">تنظيف سجل الحركات</h3>
              </div>
              <button
                onClick={() => setShowClearModal(false)}
                className="p-1 rounded-lg hover:bg-red-700 text-red-200 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                تتيح هذه العملية لمسؤول النظام تفريغ السجلات القديمة للحفاظ على كفاءة وسرعة قاعدة البيانات. حدد الخيار المطلوب:
              </p>

              <div className="space-y-2.5">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700">
                  <input
                    type="radio"
                    name="clear_option"
                    checked={clearOption === '30'}
                    onChange={() => setClearOption('30')}
                    className="w-4 h-4 text-red-600 accent-red-600"
                  />
                  <span>مسح السجلات الأقدم من 30 يوماً</span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700">
                  <input
                    type="radio"
                    name="clear_option"
                    checked={clearOption === '90'}
                    onChange={() => setClearOption('90')}
                    className="w-4 h-4 text-red-600 accent-red-600"
                  />
                  <span>مسح السجلات الأقدم من 90 يوماً</span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 cursor-pointer text-sm font-bold text-red-700">
                  <input
                    type="radio"
                    name="clear_option"
                    checked={clearOption === 'all'}
                    onChange={() => setClearOption('all')}
                    className="w-4 h-4 text-red-600 accent-red-600"
                  />
                  <span>مسح كافة السجلات بالكامل (تصفير)</span>
                </label>
              </div>

              {clearOption === 'all' && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-700 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> تحذير: هذا الإجراء لا يمكن التراجع عنه!
                  </div>
                  <p>لتأكيد مسح كافة السجلات، يرجى كتابة كلمة <strong>تأكيد</strong> في الحقل أدناه:</p>
                  <input
                    type="text"
                    value={clearConfirmText}
                    onChange={e => setClearConfirmText(e.target.value)}
                    placeholder="اكتب: تأكيد"
                    className="w-full p-2 bg-white border border-red-300 rounded-lg text-red-700 font-bold outline-none text-center"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                تنفيذ المسح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
