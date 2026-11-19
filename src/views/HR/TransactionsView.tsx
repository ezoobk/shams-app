import React, { useState, useMemo } from 'react';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import {
  DollarSign, Plus, Edit2, Trash2, Search, Calendar,
  TrendingDown, TrendingUp, AlertCircle, X, Lock, CheckCircle2, AlertTriangle
} from 'lucide-react';
import type { HRTransaction, HRTransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    employees,
    payrollRecords,
    saveTransaction,
    deleteTransaction
  } = useHR();
  const { hasPermission, currentUser } = useAuth();

  const currentYearMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingTrans, setEditingTrans] = useState<HRTransaction | null>(null);
  const [isNewTrans, setIsNewTrans] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Helper to format month name in Arabic
  const formatMonthArabic = (ym: string) => {
    if (!ym || ym.length < 7) return '';
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('ar-LY', { month: 'long', year: 'numeric' });
  };

  // Helper to check if a month is locked (approved or passed before current month)
  const isMonthLocked = (monthStr?: string) => {
    if (!monthStr) return false;
    // 1. Months with approved finalized payroll
    if (payrollRecords.some(r => r.month === monthStr && r.isApproved)) return true;
    // 2. Months strictly in the past before current active month
    if (monthStr < currentYearMonth) return true;
    return false;
  };

  const getMonthLockReason = (monthStr?: string) => {
    if (!monthStr) return '';
    if (payrollRecords.some(r => r.month === monthStr && r.isApproved)) {
      return 'معتمد ومسير رسمياً';
    }
    if (monthStr < currentYearMonth) {
      return 'شهر ماضي مغلق';
    }
    return '';
  };

  // Allowed months for modal dropdown (current + future 12 months, plus past context)
  const selectableMonths = useMemo(() => {
    const list: string[] = [];
    const [cy, cm] = currentYearMonth.split('-').map(Number);

    // Current month first
    list.push(currentYearMonth);

    // Future 12 months (e.g. advance for future months)
    for (let i = 1; i <= 12; i++) {
      let y = cy;
      let m = cm + i;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      list.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    // Past 3 months for display context
    for (let i = 1; i <= 3; i++) {
      let y = cy;
      let m = cm - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      list.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    if (editingTrans?.month && !list.includes(editingTrans.month)) {
      list.push(editingTrans.month);
    }

    return Array.from(new Set(list)).sort((a, b) => b.localeCompare(a));
  }, [currentYearMonth, editingTrans?.month]);

  // Filtered transactions for active month / filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
      const matchMonth = !selectedMonth || transMonth === selectedMonth;
      const matchType = filterType === 'all' || t.type === filterType;
      const matchEmp = filterEmployeeId === 'all' || String(t.employeeId) === String(filterEmployeeId);
      const matchSearch =
        !searchQuery ||
        (t.employeeName && t.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.reason && t.reason.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchMonth && matchType && matchEmp && matchSearch;
    });
  }, [transactions, selectedMonth, filterType, filterEmployeeId, searchQuery]);

  // Totals for this month
  const stats = useMemo(() => {
    let advances = 0;
    let deductions = 0;
    let bonuses = 0;
    let allowances = 0;

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'advance') advances += amt;
      else if (t.type === 'deduction') deductions += amt;
      else if (t.type === 'bonus') bonuses += amt;
      else if (t.type === 'allowance') allowances += amt;
    });

    return { advances, deductions, bonuses, allowances };
  }, [filteredTransactions]);

  // Open modal for new
  const handleCreateNew = () => {
    const defaultMonth = selectedMonth && !isMonthLocked(selectedMonth) ? selectedMonth : currentYearMonth;
    const newId = `TRANS_${Date.now()}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    setEditingTrans({
      id: newId,
      employeeId: employees[0]?.id || '',
      employeeName: employees[0]?.name || '',
      type: 'advance',
      amount: 0,
      date: todayStr,
      month: defaultMonth,
      reason: '',
      status: 'pending'
    });
    setIsNewTrans(true);
  };

  // Open modal for edit
  const handleEdit = (t: HRTransaction) => {
    const tMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
    if (isMonthLocked(tMonth)) {
      alert(`لا يمكن تعديل هذه الحركة لأن شهر استحقاقها (${tMonth}) ${getMonthLockReason(tMonth)}.\n\nلحماية السجلات المحاسبية المعتمدة، لا يمكن تعديل الحركات إلا بعد إلغاء اعتماد مسير ذلك الشهر أولاً من صفحة مسير الرواتب.`);
      return;
    }
    setEditingTrans({ ...t });
    setIsNewTrans(false);
  };

  // Save modal with duplicate prevention & closed month enforcement
  const handleSaveModal = async () => {
    if (!editingTrans) return;
    if (!editingTrans.employeeId) return alert('الرجاء اختيار الموظف');
    if (!editingTrans.amount || editingTrans.amount <= 0) return alert('الرجاء إدخال مبلغ صحيح أكبر من صفر');

    const transMonth = editingTrans.month || currentYearMonth;
    if (isMonthLocked(transMonth)) {
      alert(`عذراً، لا يمكن قيد حركة مالية لشهر (${transMonth}) لأن ${getMonthLockReason(transMonth)}.\n\nلحماية السجلات المحاسبية، يمكن قيد السلفيات والبدلات فقط على الأشهر الحالية المفتوحة أو المستقبلية.`);
      return;
    }

    const emp = employees.find(e => String(e.id) === String(editingTrans.employeeId));

    // Duplicate Prevention Check:
    const duplicate = transactions.find(t =>
      t.id !== editingTrans.id &&
      String(t.employeeId) === String(editingTrans.employeeId) &&
      t.type === editingTrans.type &&
      Number(t.amount) === Number(editingTrans.amount) &&
      (t.month || (t.date ? t.date.slice(0, 7) : '')) === transMonth &&
      t.status !== 'cancelled'
    );

    if (duplicate) {
      const typeLabel =
        editingTrans.type === 'advance' ? 'سلفة مالية' :
        editingTrans.type === 'deduction' ? 'خصم جزائي' :
        editingTrans.type === 'bonus' ? 'مكافأة تشجيعية' : 'بدل إضافي';

      const confirmDup = window.confirm(
        `⚠️ تنبيه منع التكرار والخطأ:\n\n` +
        `توجد حركة مالية مسجلة مسبقاً بنفس البيانات تماماً للموظف (${emp?.name || editingTrans.employeeName}):\n` +
        `• النوع: ${typeLabel}\n` +
        `• المبلغ: ${formatCurrency(editingTrans.amount)} د.ل\n` +
        `• شهر الاستحقاق: ${transMonth}\n` +
        `• تاريخ الحركة السابقة: ${duplicate.date}\n\n` +
        `هل أنت متأكد تماماً من رغبتك في تكرار هذه السلفة/الحركة وإضافتها مجدداً؟`
      );
      if (!confirmDup) return;
    }

    setIsSaving(true);
    try {
      const updated: HRTransaction = {
        ...editingTrans,
        month: transMonth,
        employeeName: emp?.name || editingTrans.employeeName || 'موظف',
        createdBy: currentUser?.displayName || editingTrans.createdBy || 'المستخدم'
      };

      await saveTransaction(updated);
      setEditingTrans(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete transaction with closed month protection
  const handleDelete = async (t: HRTransaction) => {
    const tMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
    if (isMonthLocked(tMonth)) {
      alert(`لا يمكن حذف هذه الحركة لأن شهر استحقاقها (${tMonth}) ${getMonthLockReason(tMonth)}.\n\nلحماية السجلات المحاسبية، يجب إلغاء اعتماد مسير الرواتب لذلك الشهر أولاً قبل حذف حركاته.`);
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف هذه الحركة بقيمة (${formatCurrency(t.amount)} د.ل) للموظف: ${t.employeeName}؟`)) return;
    await deleteTransaction(t.id);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            السلفيات والخصومات والمكافآت
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل ومتابعة سلف الموظفين والخصومات الجزائية والمكافآت والبدلات المعتمدة
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Month selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 mr-1" />
            <span className="text-xs font-bold text-slate-600">شهر الاستحقاق:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none font-mono"
            />
          </div>

          {/* Add button */}
          {hasPermission('hr', 'create') && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حركة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Locked Month Notification Banner */}
      {selectedMonth && isMonthLocked(selectedMonth) && (
        <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-2xl flex items-center justify-between gap-3 text-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-600 shrink-0" />
            <div>
              <span className="font-bold">شهر ({selectedMonth}) مغلق: </span>
              <span>{getMonthLockReason(selectedMonth)}. لا يمكن إضافة أو تعديل أو حذف سلفيات لهذا الشهر للحفاظ على دقة الرواتب المعتمدة.</span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-300 shrink-0">
            سجل مقفل 🔒
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-red-50/70 border border-red-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-red-700 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4" />
            إجمالي السلفيات المسحوبة
          </div>
          <div className="text-2xl font-black text-red-800 mt-1 dir-ltr font-mono">
            {formatCurrency(stats.advances)} د.ل
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            إجمالي الخصومات الجزائية
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1 dir-ltr font-mono">
            {formatCurrency(stats.deductions)} د.ل
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            إجمالي المكافآت التشجيعية
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1 dir-ltr font-mono">
            {formatCurrency(stats.bonuses)} د.ل
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            إجمالي البدلات الإضافية
          </div>
          <div className="text-2xl font-black text-blue-800 mt-1 dir-ltr font-mono">
            {formatCurrency(stats.allowances)} د.ل
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث باسم الموظف أو سبب الحركة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="w-full md:w-56">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل أنواع الحركات</option>
            <option value="advance">سلفيات فقط</option>
            <option value="deduction">خصومات فقط</option>
            <option value="bonus">مكافآت فقط</option>
            <option value="allowance">بدلات فقط</option>
          </select>
        </div>

        <div className="w-full md:w-64">
          <select
            value={filterEmployeeId}
            onChange={e => setFilterEmployeeId(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل الموظفين</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5 text-center">النوع</th>
                <th className="p-3.5 text-center">المبلغ</th>
                <th className="p-3.5 text-center">تاريخ الحركة</th>
                <th className="p-3.5 text-center">شهر الاستحقاق في الراتب</th>
                <th className="p-3.5">السبب / البيان</th>
                <th className="p-3.5 text-center">حالة المسير</th>
                <th className="p-3.5 w-24 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((t, idx) => {
                const tMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
                const isLocked = isMonthLocked(tMonth) || t.status === 'settled';

                return (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">{t.employeeName || 'موظف'}</td>
                    <td className="p-3 text-center">
                      {t.type === 'advance' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          سلفة مالية
                        </span>
                      )}
                      {t.type === 'deduction' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          خصم جزائي
                        </span>
                      )}
                      {t.type === 'bonus' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          مكافأة تشجيعية
                        </span>
                      )}
                      {t.type === 'allowance' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                          بدل إضافي
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-black font-mono text-slate-900 dir-ltr text-base">
                      {formatCurrency(t.amount)} د.ل
                    </td>
                    <td className="p-3 text-center text-xs font-mono text-slate-600">{t.date}</td>
                    <td className="p-3 text-center text-xs font-mono font-bold text-blue-700 bg-blue-50/40">
                      {t.month || (t.date ? t.date.slice(0, 7) : '-')}
                    </td>
                    <td className="p-3 text-xs text-slate-700">{t.reason || '-'}</td>
                    <td className="p-3 text-center">
                      {isLocked ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-500" />
                          معتمد ومغلق
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          قيد الاستحقاق (مسودة)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isLocked ? (
                          <span
                            className="p-1.5 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                            title={`مغلق: مسير شهر (${tMonth}) معتمد ومسير رسمياً أو من الأشهر الماضية، لا يمكن التعديل عليه أو الحذف منه`}
                          >
                            <Lock className="w-4 h-4 text-slate-400" />
                          </span>
                        ) : (
                          <>
                            {hasPermission('hr', 'edit') && (
                              <button
                                onClick={() => handleEdit(t)}
                                className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                                title="تعديل الحركة"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {hasPermission('hr', 'delete') && (
                              <button
                                onClick={() => handleDelete(t)}
                                className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                                title="حذف الحركة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    لا توجد حركات مالية مسجلة لهذا الشهر أو البحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      {editingTrans && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                {isNewTrans ? 'تسجيل حركة مالية جديدة' : 'تعديل الحركة المالية'}
              </h3>
              <button
                onClick={() => setEditingTrans(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف *</label>
                <select
                  value={editingTrans.employeeId}
                  onChange={e => setEditingTrans({ ...editingTrans, employeeId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-500"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.badgeNumber ? `(#${e.badgeNumber})` : ''} - {e.jobTitle || 'موظف'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الحركة *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'advance', label: 'سلفة مالية', color: 'border-red-300' },
                    { id: 'deduction', label: 'خصم جزائي', color: 'border-amber-300' },
                    { id: 'bonus', label: 'مكافأة تشجيعية', color: 'border-emerald-300' },
                    { id: 'allowance', label: 'بدل إضافي', color: 'border-blue-300' },
                  ].map(item => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        editingTrans.type === item.id
                          ? 'bg-blue-50 border-blue-500 font-bold'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transType"
                        checked={editingTrans.type === item.id}
                        onChange={() => setEditingTrans({ ...editingTrans, type: item.id as HRTransactionType })}
                      />
                      <span className="text-xs text-slate-800">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (دينار ليبي) *</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={editingTrans.amount || ''}
                  onChange={e => setEditingTrans({ ...editingTrans, amount: Number(e.target.value) })}
                  placeholder="0.00"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black font-mono text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ صرف / قيد السلفة</label>
                  <input
                    type="date"
                    value={editingTrans.date}
                    onChange={e => {
                      const newDate = e.target.value;
                      setEditingTrans({
                        ...editingTrans,
                        date: newDate
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شهر الاستحقاق في الراتب *</label>
                  <select
                    value={editingTrans.month || currentYearMonth}
                    onChange={e => setEditingTrans({ ...editingTrans, month: e.target.value })}
                    className={`w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold font-mono outline-none ${
                      isMonthLocked(editingTrans.month || currentYearMonth)
                        ? 'border-red-400 bg-red-50/50 text-red-800'
                        : 'border-slate-200 text-slate-800'
                    }`}
                  >
                    {selectableMonths.map(m => {
                      const locked = isMonthLocked(m);
                      return (
                        <option key={m} value={m} disabled={locked}>
                          {m === currentYearMonth
                            ? `★ ${formatMonthArabic(m)} (${m}) - الحالي`
                            : `${formatMonthArabic(m)} (${m})`}
                          {locked ? ' 🔒 (مغلق)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Locked Month Alert inside Modal */}
              {isMonthLocked(editingTrans.month || currentYearMonth) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    تنبيه: شهر الاستحقاق ({editingTrans.month || currentYearMonth}) مغلق ({getMonthLockReason(editingTrans.month || currentYearMonth)}). لا يمكن ترحيل حركات عليه.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السبب / الملاحظات</label>
                <input
                  type="text"
                  placeholder="مثال: سلفة نقدية على الحساب، مكافأة إنجاز مشروع..."
                  value={editingTrans.reason || ''}
                  onChange={e => setEditingTrans({ ...editingTrans, reason: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  onClick={() => setEditingTrans(null)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveModal}
                  disabled={isSaving || isMonthLocked(editingTrans.month || currentYearMonth)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <span>{isSaving ? 'جاري الحفظ...' : isNewTrans ? 'حفظ الحركة' : 'تحديث الحركة'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
