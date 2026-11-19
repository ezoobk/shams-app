import React, { useState, useMemo } from 'react';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Search, Plus, Edit2, Trash2, RefreshCw, X, DollarSign, CheckCircle2, ShieldAlert,
  Clock, Layers, CheckSquare, Fingerprint, UserCheck
} from 'lucide-react';
import type { HREmployee, HRSalaryType, HROvertimeMode } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const EmployeesView: React.FC = () => {
  const {
    employees,
    shifts,
    getEmployeeShifts,
    saveEmployee,
    deleteEmployee,
    deleteEmployeesBulk,
    setEmployees,
    triggerSync,
    isSyncing,
    hrSettings
  } = useHR();
  const { hasPermission } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedSalaryType, setSelectedSalaryType] = useState('all');
  const [selectedZkLink, setSelectedZkLink] = useState<'all' | 'zk' | 'manual'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showBulkShiftModal, setShowBulkShiftModal] = useState(false);
  const [bulkSelectedShiftIds, setBulkSelectedShiftIds] = useState<string[]>([]);

  const [editingEmp, setEditingEmp] = useState<HREmployee | null>(null);
  const [isNewEmp, setIsNewEmp] = useState(false);

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.deptName) set.add(e.deptName);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch =
        !searchQuery ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(e.badgeNumber || '').includes(searchQuery) ||
        (e.jobTitle && e.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDept = selectedDept === 'all' || e.deptName === selectedDept;
      const matchSalary = selectedSalaryType === 'all' || e.salaryType === selectedSalaryType;
      const matchZk =
        selectedZkLink === 'all' ||
        (selectedZkLink === 'zk' && e.isZkLinked !== false) ||
        (selectedZkLink === 'manual' && e.isZkLinked === false);

      return matchSearch && matchDept && matchSalary && matchZk;
    });
  }, [employees, searchQuery, selectedDept, selectedSalaryType, selectedZkLink]);

  // Bulk stats
  const stats = useMemo(() => {
    let monthlyCount = 0;
    let dailyCount = 0;
    let zkCount = 0;
    let manualCount = 0;
    let totalSalaries = 0;

    employees.forEach(e => {
      if (e.isZkLinked === false) {
        manualCount++;
      } else {
        zkCount++;
      }

      if (e.salaryType === 'daily') {
        dailyCount++;
      } else {
        monthlyCount++;
        totalSalaries += Number(e.basicSalary) || 0;
      }
    });

    return {
      total: employees.length,
      zkCount,
      manualCount,
      monthlyCount,
      dailyCount,
      totalSalaries
    };
  }, [employees]);

  // Open modal for new employee
  const handleCreateNew = () => {
    const newId = `EMP_${Date.now()}`;
    const defaultShiftId = hrSettings.defaultShiftId || shifts[0]?.id || '';
    setEditingEmp({
      id: newId,
      badgeNumber: '',
      name: '',
      phone: '',
      ssn: '',
      deptName: departments[0] || 'الإدارة',
      jobTitle: 'موظف',
      shiftId: defaultShiftId,
      shiftIds: defaultShiftId ? [defaultShiftId] : [],
      isZkLinked: false, // متاح كخيار مباشر: غير مربوط بالبصمة أو مربوط
      attendanceMode: 'auto_present',
      salaryType: 'monthly',
      basicSalary: 0,
      dailyRate: 0,
      overtimeMode: 'general',
      overtimePercent: 125,
      overtimeFixedAmount: 15,
      isActive: true
    });
    setIsNewEmp(true);
  };

  // Open modal for editing employee
  const handleEdit = (emp: HREmployee) => {
    const currentShiftIds = Array.isArray(emp.shiftIds) && emp.shiftIds.length > 0
      ? emp.shiftIds
      : (emp.shiftId ? [emp.shiftId] : []);
    const isZk = emp.isZkLinked !== false;
    const defaultAttMode = isZk ? 'biometric' : (emp.salaryType === 'daily' ? 'manual' : 'auto_present');
    setEditingEmp({
      ...emp,
      badgeNumber: emp.badgeNumber || '',
      isZkLinked: isZk,
      attendanceMode: emp.attendanceMode || defaultAttMode,
      shiftIds: currentShiftIds,
      shiftId: currentShiftIds[0] || emp.shiftId || ''
    });
    setIsNewEmp(false);
  };

  // Save employee changes
  const handleSaveModal = async () => {
    if (!editingEmp) return;
    if (!editingEmp.name.trim()) return alert('الرجاء إدخال اسم الموظف');

    const isZk = editingEmp.isZkLinked !== false;
    const trimmedBadge = String(editingEmp.badgeNumber || '').trim();

    if (isZk) {
      if (!trimmedBadge) {
        return alert('الرجاء إدخال رقم البصمة في الجهاز (Badge Number) للموظف المربوط بجهاز البصمة');
      }
      const duplicate = employees.find(
        e => e.id !== editingEmp.id && e.isZkLinked !== false && String(e.badgeNumber || '').trim() === trimmedBadge
      );
      if (duplicate) {
        return alert(`رقم البصمة (${trimmedBadge}) مستخدم بالفعل للموظف: "${duplicate.name}". يرجى إدخال رقم بصمة آخر.`);
      }
    } else {
      // Non-biometric employee: badge is optional
      if (trimmedBadge) {
        const duplicate = employees.find(
          e => e.id !== editingEmp.id && String(e.badgeNumber || '').trim() === trimmedBadge
        );
        if (duplicate) {
          return alert(`الرقم الوظيفي أو الكود (${trimmedBadge}) مستخدم بالفعل للموظف: "${duplicate.name}".`);
        }
      }
    }

    const currentShiftIds = Array.isArray(editingEmp.shiftIds) && editingEmp.shiftIds.length > 0
      ? editingEmp.shiftIds
      : (editingEmp.shiftId ? [editingEmp.shiftId] : []);

    const defaultAttMode = isZk ? 'biometric' : (editingEmp.salaryType === 'daily' ? 'manual' : 'auto_present');

    await saveEmployee({
      ...editingEmp,
      badgeNumber: trimmedBadge,
      isZkLinked: isZk,
      attendanceMode: editingEmp.attendanceMode || defaultAttMode,
      shiftIds: currentShiftIds,
      shiftId: currentShiftIds[0] || ''
    });
    setEditingEmp(null);
  };

  // Bulk assign shifts to selected employees
  const handleBulkAssignShifts = async () => {
    if (selectedIds.length === 0) return;
    if (bulkSelectedShiftIds.length === 0) {
      return alert('الرجاء اختيار وردية واحدة على الأقل');
    }

    const updated = employees.map(emp => {
      if (selectedIds.includes(emp.id)) {
        return {
          ...emp,
          shiftIds: bulkSelectedShiftIds,
          shiftId: bulkSelectedShiftIds[0] || ''
        };
      }
      return emp;
    });

    await setEmployees(updated);
    setShowBulkShiftModal(false);
    setSelectedIds([]);
    alert(`تم تعيين جداول العمل لـ (${selectedIds.length}) موظف بنجاح.`);
  };

  // Delete single employee
  const handleDelete = async (emp: HREmployee) => {
    if (!window.confirm(`هل أنت متأكد من حذف الموظف: "${emp.name}"؟`)) return;
    await deleteEmployee(emp.id);
    setSelectedIds(prev => prev.filter(id => id !== emp.id));
  };

  // Bulk delete selected employees
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف (${selectedIds.length}) موظف دفعة واحدة من المنظومة؟`)) return;
    await deleteEmployeesBulk(selectedIds);
    setSelectedIds([]);
  };

  // Match active employees with physical device (purges removed employees)
  const handleMatchActive = async () => {
    const ip = hrSettings.zkDeviceIp || '192.168.16.200';
    if (!window.confirm(
      `هل تريد مطابقة الموظفين مع جهاز البصمة (${ip})؟\n\n` +
      `سيتم استيراد واعتماد الموظفين النشطين في الجهاز فقط، وحذف الموظفين القدامى غير المسجلين في الجهاز من المنظومة نهائياً.`
    )) return;

    const res = await triggerSync({ matchActiveOnly: true, purgeMissing: true });
    if (res.success) {
      alert(
        `تمت المطابقة بنجاح!\n` +
        `• الموظفون النشطون في الجهاز: ${res.activeUsersCount || res.totalUsers}\n` +
        `• الموظفون القدامى الذين تم حذفهم: ${res.purgedUsersCount || 0}`
      );
    } else {
      alert(`تعذرت المطابقة مع الجهاز: ${res.error}`);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" />
            دليل وسجلات الموظفين
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة بيانات الموظفين، ربط الورديات، وتحديد أنظمة الرواتب وسعر ساعات العمل الإضافي
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Match Active with Device */}
          {hasPermission('hr', 'sync') && (
            <button
              onClick={handleMatchActive}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50 shadow-2xs"
              title="مطابقة الموظفين مع جهاز البصمة وحذف الموظفين القدامى غير المسجلين"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>مطابقة مع الجهاز (الموظفين النشطين)</span>
            </button>
          )}

          {/* Sync Button */}
          {hasPermission('hr', 'sync') && (
            <button
              onClick={() => triggerSync({ syncEmployees: true })}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              title="سحب وتحديث بيانات الموظفين المسجلين في جهاز البصمة"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري السحب...' : 'سحب الموظفين من الجهاز'}</span>
            </button>
          )}

          {/* Add Employee Button */}
          {hasPermission('hr', 'create') && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موظف جديد</span>
            </button>
          )}

          {/* View mode toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              جدول
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              بطاقات
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">إجمالي الموظفين</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-blue-700 font-bold">{stats.zkCount} بالبصمة</span>
            <span>•</span>
            <span className="text-purple-700 font-bold">{stats.manualCount} بدون بصمة</span>
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-blue-700">نظام الراتب الشهري الثابت</div>
          <div className="text-2xl font-black text-blue-800 mt-1">{stats.monthlyCount} موظف</div>
          <div className="text-[11px] text-blue-600/80 mt-1">يُصرف مرتب شهري معتمد</div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-amber-700">نظام اليومية (حسب الأيام)</div>
          <div className="text-2xl font-black text-amber-800 mt-1">{stats.dailyCount} موظف</div>
          <div className="text-[11px] text-amber-700/80 mt-1">يُحسب الأجر بالأيام الفعلية</div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-emerald-700">إجمالي الرواتب الأساسية الشهرية</div>
          <div className="text-xl font-black text-emerald-800 mt-1 dir-ltr">{formatCurrency(stats.totalSalaries)} د.ل</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">الكتلة الشهرية للمرتبات الثابتة</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث باسم الموظف، المسمى الوظيفي، أو كود البصمة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="w-full md:w-52">
          <select
            value={selectedZkLink}
            onChange={e => setSelectedZkLink(e.target.value as any)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل الموظفين (بصمة + يدوي)</option>
            <option value="zk">مربوطين بجهاز البصمة ({stats.zkCount})</option>
            <option value="manual">غير مربوطين بالبصمة ({stats.manualCount})</option>
          </select>
        </div>

        <div className="w-full md:w-48">
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل الأقسام ({departments.length})</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-48">
          <select
            value={selectedSalaryType}
            onChange={e => setSelectedSalaryType(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل أنظمة الأجور</option>
            <option value="monthly">راتب شهري ثابت</option>
            <option value="daily">يومية عمل</option>
          </select>
        </div>
      </div>

      {/* Bulk Selection Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-blue-900 bg-blue-100 px-3 py-1 rounded-lg">
              تم تحديد {selectedIds.length} موظف
            </span>
            <span className="text-xs text-blue-700 hidden sm:inline">
              يمكنك حذف الموظفين المحددين دفعة واحدة أو إلغاء التحديد
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission('hr', 'edit') && (
              <button
                onClick={() => {
                  setBulkSelectedShiftIds([]);
                  setShowBulkShiftModal(true);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                title="تعيين جدول عمل أو وردية مخصصة للموظفين المحددين"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>تعيين جدول عمل ({selectedIds.length})</span>
              </button>
            )}
            {hasPermission('hr', 'delete') && (
              <button
                onClick={handleBulkDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف ({selectedIds.length}) موظف</span>
              </button>
            )}
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Employees Render: Table Mode */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      title="تحديد الكل"
                    />
                  </th>
                  <th className="p-3.5 w-14 text-center">كود</th>
                  <th className="p-3.5">اسم الموظف</th>
                  <th className="p-3.5">القسم</th>
                  <th className="p-3.5">الوظيفة</th>
                  <th className="p-3.5">الوردية</th>
                  <th className="p-3.5 text-center">نظام الراتب</th>
                  <th className="p-3.5 text-center">الراتب / اليومية</th>
                  <th className="p-3.5 text-center">احتساب الإضافي</th>
                  <th className="p-3.5 text-center">الحالة</th>
                  <th className="p-3.5 w-24 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const empShifts = getEmployeeShifts(emp);
                  const isSelected = selectedIds.includes(emp.id);
                  return (
                    <tr
                      key={emp.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(emp.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        {emp.isZkLinked !== false ? (
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded inline-flex items-center gap-1" title="مربوط بجهاز البصمة">
                            <Fingerprint className="w-3 h-3 text-blue-600" />
                            <span>#{emp.badgeNumber || emp.id}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded inline-flex items-center gap-1" title="غير مربوط بجهاز البصمة (دوام يدوي / معتمد)">
                            <UserCheck className="w-3 h-3 text-purple-600" />
                            <span>{emp.badgeNumber ? `#${emp.badgeNumber}` : 'يدوي'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{emp.name}</span>
                          {emp.isZkLinked === false && (
                            <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                              بدون بصمة
                            </span>
                          )}
                          {emp.isZkLinked !== false && emp.attendanceMode === 'overtime_only' && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-bold" title="دوام رسمي معتمد تلقائياً - البصمة لاحتساب العمل الإضافي فقط">
                              بصمة للإضافي فقط
                            </span>
                          )}
                        </div>
                        {emp.phone && (
                          <div className="text-[11px] text-slate-400 font-mono font-normal">{emp.phone}</div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-700">{emp.deptName || 'عام'}</td>
                      <td className="p-3 text-xs text-slate-700">{emp.jobTitle || 'موظف'}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {empShifts.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700"
                              title={`${s.name} (${s.startTime} - ${s.endTime})`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || '#2563eb' }} />
                              <span>{s.name}</span>
                              <span className="font-mono text-[10px] text-slate-500">({s.startTime}-{s.endTime})</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          emp.salaryType === 'daily'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {emp.salaryType === 'daily' ? 'يومية' : 'شهري'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold font-mono text-slate-800 dir-ltr">
                        {emp.salaryType === 'daily'
                          ? `${formatCurrency(emp.dailyRate || 0)} د.ل / يوم`
                          : `${formatCurrency(emp.basicSalary || 0)} د.ل`}
                      </td>
                      <td className="p-3 text-center text-xs">
                        {emp.overtimeMode === 'fixed' ? (
                          <span className="font-bold text-purple-700 font-mono">{formatCurrency(emp.overtimeFixedAmount)} د.ل/ساعة</span>
                        ) : emp.overtimeMode === 'percent' ? (
                          <span className="font-bold text-purple-700 font-mono">{emp.overtimePercent}%</span>
                        ) : (
                          <span className="text-slate-500">القاعدة العامة</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          emp.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {emp.isActive !== false ? 'نشط' : 'متوقف'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasPermission('hr', 'edit') && (
                            <button
                              onClick={() => handleEdit(emp)}
                              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                              title="تعديل بيانات الموظف والراتب"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('hr', 'delete') && (
                            <button
                              onClick={() => handleDelete(emp)}
                              className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                              title="حذف الموظف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      لا يوجد موظفون مطابقون لشروط البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employees Render: Cards Mode */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const empShifts = getEmployeeShifts(emp);
            return (
              <div
                key={emp.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center font-mono border ${
                        emp.isZkLinked !== false
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {emp.isZkLinked !== false ? (
                          emp.badgeNumber || emp.id
                        ) : (
                          <UserCheck className="w-5 h-5 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-base">{emp.name}</h4>
                          {emp.isZkLinked === false && (
                            <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                              بدون بصمة
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{emp.jobTitle || 'موظف'} • {emp.deptName || 'عام'}</div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      emp.salaryType === 'daily' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {emp.salaryType === 'daily' ? 'يومية' : 'شهري'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 flex-shrink-0">الورديات المقررة:</span>
                      <div className="flex flex-col items-end gap-1">
                        {empShifts.map((s, sIdx) => (
                          <span key={sIdx} className="font-bold text-slate-700 flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color || '#2563eb' }} />
                            <span>{s.name}</span>
                            <span className="font-mono text-[10px] text-slate-500">({s.startTime}-{s.endTime})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">الراتب الأساسي / اليومية:</span>
                      <span className="font-black text-slate-900 font-mono">
                        {emp.salaryType === 'daily'
                          ? `${formatCurrency(emp.dailyRate || 0)} د.ل / يوم`
                          : `${formatCurrency(emp.basicSalary || 0)} د.ل`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">سعر ساعة الإضافي:</span>
                      <span className="font-bold text-purple-700 font-mono">
                        {emp.overtimeMode === 'fixed'
                          ? `${formatCurrency(emp.overtimeFixedAmount)} د.ل/ساعة`
                          : emp.overtimeMode === 'percent'
                          ? `${emp.overtimePercent}%`
                          : 'القاعدة العامة'}
                      </span>
                    </div>

                    {emp.phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">الهاتف:</span>
                        <span className="font-mono text-slate-700">{emp.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  {hasPermission('hr', 'edit') && (
                    <button
                      onClick={() => handleEdit(emp)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      تعديل
                    </button>
                  )}
                  {hasPermission('hr', 'delete') && (
                    <button
                      onClick={() => handleDelete(emp)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                {isNewEmp ? 'إضافة موظف جديد' : `تعديل بيانات: ${editingEmp.name}`}
              </h3>
              <button
                onClick={() => setEditingEmp(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Biometric Link / Connection Type Selector */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-blue-600" />
                    نوع تسجيل الموظف وارتباطه بجهاز البصمة (ZKTeco)
                  </label>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    editingEmp.isZkLinked === false
                      ? 'bg-purple-100 text-purple-800'
                      : (editingEmp.attendanceMode === 'overtime_only' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')
                  }`}>
                    {editingEmp.isZkLinked === false
                      ? 'موظف يدوي (بدون بصمة)'
                      : (editingEmp.attendanceMode === 'overtime_only' ? 'بصمة للإضافي فقط' : 'مربوط بالجهاز (حضور كامل)')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setEditingEmp({
                        ...editingEmp,
                        isZkLinked: true,
                        attendanceMode: editingEmp.attendanceMode === 'overtime_only' ? 'overtime_only' : 'biometric',
                        badgeNumber: editingEmp.badgeNumber || String(employees.length + 1)
                      });
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      editingEmp.isZkLinked !== false
                        ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${editingEmp.isZkLinked !== false ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">مربوط بجهاز البصمة (ZKTeco)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        مسجل في الجهاز برقم بصمة وتُسحب حركات حضوره وانصرافه آلياً
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setEditingEmp({
                        ...editingEmp,
                        isZkLinked: false,
                        attendanceMode: editingEmp.salaryType === 'daily' ? 'manual' : 'auto_present',
                        badgeNumber: ''
                      });
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      editingEmp.isZkLinked === false
                        ? 'bg-purple-50/90 border-purple-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${editingEmp.isZkLinked === false ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">غير مربوط بجهاز البصمة (يدوي / معتمد)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        يتقاضى مرتب شهري أو يومي دون الحاجة للبصم على الجهاز
                      </div>
                    </div>
                  </div>
                </div>

                {/* If biometric: Biometric Mode Setting (Full vs Overtime Only) */}
                {editingEmp.isZkLinked !== false && (
                  <div className="pt-3 border-t border-slate-200/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">نظام تسجيل وحساب البصمة للموظف:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                        editingEmp.attendanceMode !== 'overtime_only' ? 'bg-white border-blue-400 font-bold text-blue-900 shadow-2xs' : 'bg-slate-100/70 border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="zkAttendanceMode"
                          checked={editingEmp.attendanceMode !== 'overtime_only'}
                          onChange={() => setEditingEmp({ ...editingEmp, attendanceMode: 'biometric' })}
                          className="text-blue-600 mt-0.5"
                        />
                        <div>
                          <div>حضور وانصراف كامل بالبصمة (الافتراضي)</div>
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                            مطالب ببصمة الدخول والخروج للدوام الرسمي، ويُخصم عليه التأخير والخروج المبكر والغياب إذا لم يبصم.
                          </div>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                        editingEmp.attendanceMode === 'overtime_only' ? 'bg-white border-amber-400 font-bold text-amber-900 shadow-2xs' : 'bg-slate-100/70 border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="zkAttendanceMode"
                          checked={editingEmp.attendanceMode === 'overtime_only'}
                          onChange={() => setEditingEmp({ ...editingEmp, attendanceMode: 'overtime_only' })}
                          className="text-amber-600 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>بصمة لاحتساب الإضافي فقط</span>
                            <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold">دوام معتمد</span>
                          </div>
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                            غير مطالب بتسجيل الدخول والخروج للدوام الرسمي (حاضر تلقائياً وبدون أي خصم)، وبصماته تُسجل حصراً لاحتساب ساعات العمل الإضافي.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* If non-biometric: Attendance Tracking Mode Setting */}
                {editingEmp.isZkLinked === false && (
                  <div className="pt-3 border-t border-slate-200/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">آلية احتساب الدوام والحضور للراتب:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                        editingEmp.attendanceMode !== 'manual' ? 'bg-white border-purple-400 font-bold text-purple-900 shadow-2xs' : 'bg-slate-100/70 border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="attendanceMode"
                          checked={editingEmp.attendanceMode !== 'manual'}
                          onChange={() => setEditingEmp({ ...editingEmp, attendanceMode: 'auto_present' })}
                          className="text-purple-600 mt-0.5"
                        />
                        <div>
                          <div>دوام كامل معتمد تلقائياً (الافتراضي للمرتب الشهري)</div>
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                            يُعتبر حاضراً في كافة أيام العمل الرسمية وتُصرف مستحقاته كاملة ما لم تسجل إجازة أو غياب
                          </div>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                        editingEmp.attendanceMode === 'manual' ? 'bg-white border-purple-400 font-bold text-purple-900 shadow-2xs' : 'bg-slate-100/70 border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="attendanceMode"
                          checked={editingEmp.attendanceMode === 'manual'}
                          onChange={() => setEditingEmp({ ...editingEmp, attendanceMode: 'manual' })}
                          className="text-purple-600 mt-0.5"
                        />
                        <div>
                          <div>تسجيل يدوي بحسب الأيام الفعلية (الأنسب لليومية)</div>
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                            يُحسب الحضور فقط في الأيام التي يُسجل فيها حضوره من شاشة الحضور اليومي
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Basic Info: Name & Badge / Internal Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف الكامل *</label>
                  <input
                    type="text"
                    value={editingEmp.name}
                    onChange={e => setEditingEmp({ ...editingEmp, name: e.target.value })}
                    placeholder="مثال: أحمد عبد الله، سالم المحمودي..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingEmp.isZkLinked !== false ? 'رقم البصمة في الجهاز (Badge) *' : 'الرقم الوظيفي / الكود (اختياري)'}
                  </label>
                  <input
                    type="text"
                    value={editingEmp.badgeNumber || ''}
                    placeholder={editingEmp.isZkLinked !== false ? 'مثال: 12' : 'مثال: M-101 أو اتركه فارغاً'}
                    onChange={e => setEditingEmp({ ...editingEmp, badgeNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:bg-white text-center"
                  />
                </div>
              </div>

              {/* Job & Department */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم</label>
                  <input
                    type="text"
                    value={editingEmp.deptName || ''}
                    onChange={e => setEditingEmp({ ...editingEmp, deptName: e.target.value })}
                    placeholder="مثال: الإدارة، الورشة، المالية..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={editingEmp.jobTitle || ''}
                    onChange={e => setEditingEmp({ ...editingEmp, jobTitle: e.target.value })}
                    placeholder="مثال: مهندس، فني لحام، محاسب..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              {/* Work Schedules (Multiple Shifts) Selection */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      جداول العمل والورديات المقررة للموظف
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      يمكنك تحديد أكثر من جدول عمل لنفس الموظف (مثلاً فترة صباحية ومسائية)
                    </p>
                  </div>

                  {/* Preset 2 Shifts Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const mShift = shifts.find(s => (s.startTime && s.startTime.startsWith('09')) || s.name.includes('صباح'));
                      const eShift = shifts.find(s => (s.startTime && s.startTime.startsWith('14')) || s.name.includes('مساء'));
                      const targetIds: string[] = [];
                      if (mShift) targetIds.push(mShift.id);
                      if (eShift && (!mShift || eShift.id !== mShift.id)) targetIds.push(eShift.id);
                      if (targetIds.length > 0) {
                        setEditingEmp({
                          ...editingEmp,
                          shiftIds: targetIds,
                          shiftId: targetIds[0]
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>تطبيق دوام فترتين (09:00 - 13:00 ثم 14:00 - 18:00)</span>
                  </button>
                </div>

                {/* Shift Checkbox Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                  {shifts.map(s => {
                    const currentSelected = editingEmp.shiftIds || (editingEmp.shiftId ? [editingEmp.shiftId] : []);
                    const isSelected = currentSelected.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          let nextIds: string[];
                          if (isSelected) {
                            nextIds = currentSelected.filter(id => id !== s.id);
                          } else {
                            nextIds = [...currentSelected, s.id];
                          }
                          setEditingEmp({
                            ...editingEmp,
                            shiftIds: nextIds,
                            shiftId: nextIds[0] || ''
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-400 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 pointer-events-none mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || '#2563eb' }} />
                            <span className="font-bold text-slate-800 truncate">{s.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {s.startTime} - {s.endTime} ({s.workHours} س)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary of Selected Shifts */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    الورديات المحددة: <span className="font-bold text-blue-700 font-mono">{(editingEmp.shiftIds || []).length}</span>
                  </span>
                  <span className="text-slate-600">
                    إجمالي ساعات الدوام المقررة: <span className="font-black text-slate-900 font-mono">
                      {shifts
                        .filter(s => (editingEmp.shiftIds || []).includes(s.id))
                        .reduce((sum, s) => sum + (Number(s.workHours) || 0), 0)} ساعات / يوم
                    </span>
                  </span>
                </div>
              </div>

              {/* Salary System Configuration */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  إعدادات نظام الأجر والراتب
                </div>

                <div className="flex gap-4">
                  <label className="flex-1 flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                    <input
                      type="radio"
                      name="modalSalaryType"
                      checked={editingEmp.salaryType === 'monthly'}
                      onChange={() => setEditingEmp({
                        ...editingEmp,
                        salaryType: 'monthly',
                        attendanceMode: editingEmp.isZkLinked === false ? 'auto_present' : editingEmp.attendanceMode
                      })}
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900">راتب شهري ثابت (الافتراضي)</div>
                      <div className="text-[11px] text-slate-500">يُصرف مرتب شهري ثابت مع خصم أيام الغياب ودقائق التأخير</div>
                    </div>
                  </label>

                  <label className="flex-1 flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-400 transition-colors">
                    <input
                      type="radio"
                      name="modalSalaryType"
                      checked={editingEmp.salaryType === 'daily'}
                      onChange={() => setEditingEmp({
                        ...editingEmp,
                        salaryType: 'daily',
                        attendanceMode: editingEmp.isZkLinked === false ? 'manual' : editingEmp.attendanceMode
                      })}
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900">نظام اليومية</div>
                      <div className="text-[11px] text-slate-500">يُحسب الراتب بضرب اليومية في عدد أيام الحضور الفعلية</div>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {editingEmp.salaryType === 'monthly' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">قيمة الراتب الشهري الأساسي (د.ل) *</label>
                      <input
                        type="number"
                        value={editingEmp.basicSalary || ''}
                        onChange={e => setEditingEmp({ ...editingEmp, basicSalary: Number(e.target.value) })}
                        placeholder="0.00"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-base font-black font-mono text-emerald-700 outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">أجر اليومية الواحدة (د.ل) *</label>
                      <input
                        type="number"
                        value={editingEmp.dailyRate || ''}
                        onChange={e => setEditingEmp({ ...editingEmp, dailyRate: Number(e.target.value) })}
                        placeholder="0.00"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-base font-black font-mono text-amber-700 outline-none"
                      />
                    </div>
                  )}

                  {/* Overtime Configuration */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">طريقة احتساب أجر الساعات الإضافية</label>
                    <select
                      value={editingEmp.overtimeMode || 'general'}
                      onChange={e => setEditingEmp({ ...editingEmp, overtimeMode: e.target.value as HROvertimeMode })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                    >
                      <option value="general">حسب القاعدة العامة للمنشأة</option>
                      <option value="percent">نسبة مئوية مخصصة من أجر ساعة الموظف</option>
                      <option value="fixed">مبلغ مالي ثابت لكل ساعة إضافي</option>
                    </select>

                    {editingEmp.overtimeMode === 'percent' && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          value={editingEmp.overtimePercent || 125}
                          onChange={e => setEditingEmp({ ...editingEmp, overtimePercent: Number(e.target.value) })}
                          className="w-24 p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center font-mono"
                        />
                        <span className="text-xs text-slate-600">% من قيمة الساعة (مثال 125% أو 150%)</span>
                      </div>
                    )}

                    {editingEmp.overtimeMode === 'fixed' && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          value={editingEmp.overtimeFixedAmount || 15}
                          onChange={e => setEditingEmp({ ...editingEmp, overtimeFixedAmount: Number(e.target.value) })}
                          className="w-24 p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center font-mono"
                        />
                        <span className="text-xs text-slate-600">دينار ليبي لكل ساعة إضافية</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Extra contact info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editingEmp.phone || ''}
                    onChange={e => setEditingEmp({ ...editingEmp, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الوطني / الهوية</label>
                  <input
                    type="text"
                    value={editingEmp.ssn || ''}
                    onChange={e => setEditingEmp({ ...editingEmp, ssn: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none"
                  />
                </div>
              </div>

              {/* Status toggle */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEmp.isActive !== false}
                    onChange={e => setEditingEmp({ ...editingEmp, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm font-bold text-slate-800">حساب الموظف نشط ويعمل حالياً</span>
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5 flex-shrink-0">
              <button
                onClick={() => setEditingEmp(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl border border-slate-200"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveModal}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Shifts Modal */}
      {showBulkShiftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  تعيين جدول عمل لـ ({selectedIds.length}) موظف محدد
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  حدد الوردية أو الورديات التي سيتم تطبيقها على الموظفين المحددين
                </p>
              </div>
              <button
                onClick={() => setShowBulkShiftModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preset Button */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs">
                <span className="font-medium text-blue-900">
                  هل يعمل الموظفون فترتين (09:00 - 13:00 ثم 14:00 - 18:00)؟
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const mShift = shifts.find(s => (s.startTime && s.startTime.startsWith('09')) || s.name.includes('صباح'));
                    const eShift = shifts.find(s => (s.startTime && s.startTime.startsWith('14')) || s.name.includes('مساء'));
                    const targetIds: string[] = [];
                    if (mShift) targetIds.push(mShift.id);
                    if (eShift && (!mShift || eShift.id !== mShift.id)) targetIds.push(eShift.id);
                    setBulkSelectedShiftIds(targetIds);
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs self-start sm:self-auto"
                >
                  اختيار فترتين تلقائياً
                </button>
              </div>

              {/* Shift list */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {shifts.map(s => {
                  const isChecked = bulkSelectedShiftIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setBulkSelectedShiftIds(bulkSelectedShiftIds.filter(id => id !== s.id));
                          } else {
                            setBulkSelectedShiftIds([...bulkSelectedShiftIds, s.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#2563eb' }} />
                          <span className="font-bold text-slate-800 text-sm">{s.name}</span>
                        </div>
                        <span className="font-mono text-xs text-slate-500 font-bold">
                          {s.startTime} - {s.endTime} ({s.workHours} س)
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="text-xs text-slate-600 flex justify-between pt-2 border-t border-slate-100">
                <span>الورديات المحددة: <b className="text-blue-700 font-mono">{bulkSelectedShiftIds.length}</b></span>
                <span>
                  إجمالي الساعات: <b className="text-slate-900 font-mono">
                    {shifts
                      .filter(s => bulkSelectedShiftIds.includes(s.id))
                      .reduce((sum, s) => sum + (Number(s.workHours) || 0), 0)} س / يوم
                  </b>
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                onClick={() => setShowBulkShiftModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl border border-slate-200"
              >
                إلغاء
              </button>
              <button
                onClick={handleBulkAssignShifts}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs"
              >
                تطبيق وتعيين
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
