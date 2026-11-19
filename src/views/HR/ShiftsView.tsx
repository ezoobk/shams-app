import React, { useState } from 'react';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import {
  Clock, Plus, Edit2, Trash2, Users, X, ArrowRightLeft
} from 'lucide-react';
import type { HRShift } from '../../types';

export const ShiftsView: React.FC = () => {
  const {
    shifts,
    employees,
    saveShift,
    deleteShift,
    setEmployees
  } = useHR();
  const { hasPermission } = useAuth();

  const [editingShift, setEditingShift] = useState<HRShift | null>(null);
  const [isNewShift, setIsNewShift] = useState(false);

  // Assignment Modal
  const [assigningShift, setAssigningShift] = useState<HRShift | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // Count employees per shift
  const getEmployeeCountForShift = (shiftId: string, isDefault?: boolean) => {
    return employees.filter(e => {
      const ids = Array.isArray(e.shiftIds) && e.shiftIds.length > 0 ? e.shiftIds : (e.shiftId ? [e.shiftId] : []);
      if (ids.includes(shiftId)) return true;
      if (ids.length === 0 && isDefault) return true;
      return false;
    }).length;
  };

  // Open modal for new shift
  const handleCreateNew = () => {
    const newId = `SHIFT_${Date.now()}`;
    setEditingShift({
      id: newId,
      name: '',
      startTime: '08:00',
      endTime: '17:00',
      lateGraceMinutes: 10,
      earlyGraceMinutes: 10,
      isSplitShift: false,
      splitBreakStart: '13:00',
      splitBreakEnd: '14:00',
      workHours: 8,
      color: '#2563eb',
      isDefault: false,
      notes: ''
    });
    setIsNewShift(true);
  };

  // Open modal for edit shift
  const handleEdit = (shift: HRShift) => {
    setEditingShift({
      ...shift,
      isSplitShift: !!shift.isSplitShift,
      splitBreakStart: shift.splitBreakStart || '13:00',
      splitBreakEnd: shift.splitBreakEnd || '14:00'
    });
    setIsNewShift(false);
  };

  // Save shift
  const handleSaveModal = async () => {
    if (!editingShift) return;
    if (!editingShift.name.trim()) return alert('الرجاء كتابة اسم جدول العمل / الوردية');

    await saveShift(editingShift);
    setEditingShift(null);
  };

  // Delete shift
  const handleDelete = async (shift: HRShift) => {
    const count = getEmployeeCountForShift(shift.id, shift.isDefault);
    if (count > 0) {
      if (!window.confirm(`هناك ${count} موظفاً مرتبطاً بهذا الجدول. عند حذفه، سيتحولون للجدول الافتراضي. هل تريد المتابعة؟`)) {
        return;
      }
    } else {
      if (!window.confirm(`هل أنت متأكد من حذف الوردية: "${shift.name}"؟`)) return;
    }
    await deleteShift(shift.id);
  };

  // Open assign modal
  const handleOpenAssign = (shift: HRShift) => {
    setAssigningShift(shift);
    // Pre-select employees who have this shift in their assigned shifts
    const currentInShift = employees
      .filter(e => {
        const ids = Array.isArray(e.shiftIds) && e.shiftIds.length > 0 ? e.shiftIds : (e.shiftId ? [e.shiftId] : []);
        return ids.includes(shift.id) || (ids.length === 0 && shift.isDefault);
      })
      .map(e => e.id);
    setSelectedEmpIds(currentInShift);
  };

  // Save bulk employee assignment (supports multi-shift)
  const handleSaveAssignment = async () => {
    if (!assigningShift) return;

    const updatedEmployees = employees.map(emp => {
      const isSelected = selectedEmpIds.includes(emp.id);
      const currentIds = Array.isArray(emp.shiftIds) && emp.shiftIds.length > 0
        ? [...emp.shiftIds]
        : (emp.shiftId ? [emp.shiftId] : []);

      let nextIds: string[];
      if (isSelected) {
        if (!currentIds.includes(assigningShift.id)) {
          nextIds = [...currentIds, assigningShift.id];
        } else {
          nextIds = currentIds;
        }
      } else {
        nextIds = currentIds.filter(id => id !== assigningShift.id);
      }

      return {
        ...emp,
        shiftIds: nextIds,
        shiftId: nextIds[0] || ''
      };
    });

    await setEmployees(updatedEmployees);
    setAssigningShift(null);
    alert(`تم تحديث جدول العمل لـ (${selectedEmpIds.length}) موظف بنجاح.`);
  };

  const toggleSelectAll = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(employees.map(e => e.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-blue-600" />
            جداول العمل والورديات
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تعريف مواعيد الدوام الرسمي، فترات السماح بالتأخير، وتعيين الجدول المناسب لكل موظف
          </p>
        </div>

        {hasPermission('hr', 'create') && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء جدول عمل جديد</span>
          </button>
        )}
      </div>

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {shifts.map(shift => {
          const empCount = getEmployeeCountForShift(shift.id, shift.isDefault);
          return (
            <div
              key={shift.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Title & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: shift.color || '#2563eb' }}
                    />
                    <h3 className="font-bold text-slate-900 text-lg">{shift.name}</h3>
                  </div>

                  {shift.isDefault && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                      الافتراضية
                    </span>
                  )}
                </div>

                {/* Timing details */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">وقت الحضور والانصراف:</span>
                    <span className="font-black text-slate-800 font-mono text-sm">
                      {shift.startTime} - {shift.endTime}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">ساعات العمل المقررة:</span>
                    <span className="font-bold text-slate-700">{shift.workHours} ساعات</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">فترة السماح بالتأخير:</span>
                    <span className="font-bold text-amber-700">{shift.lateGraceMinutes} دقيقة</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">فترة السماح بالانصراف المبكر:</span>
                    <span className="font-bold text-slate-700">{shift.earlyGraceMinutes} دقيقة</span>
                  </div>

                  {(shift.minOvertimeMinutes !== undefined && shift.minOvertimeMinutes !== null && shift.minOvertimeMinutes > 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">الحد الأدنى للإضافي:</span>
                      <span className="font-bold text-purple-700">{shift.minOvertimeMinutes} دقيقة</span>
                    </div>
                  )}

                  {(shift.maxDailyOvertimeHours !== undefined && shift.maxDailyOvertimeHours !== null && shift.maxDailyOvertimeHours > 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">الحد الأعلى للإضافي اليومي:</span>
                      <span className="font-bold text-purple-700">{shift.maxDailyOvertimeHours} ساعة</span>
                    </div>
                  )}

                  {(shift.missingPunchPenaltyHours !== undefined && shift.missingPunchPenaltyHours !== null && shift.missingPunchPenaltyHours >= 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">خصم البصمة الناقصة:</span>
                      <span className="font-bold text-rose-700">{shift.missingPunchPenaltyHours} ساعات تأخير</span>
                    </div>
                  )}

                  {shift.notes && (
                    <div className="pt-1 border-t border-slate-200 text-slate-500 italic">
                      {shift.notes}
                    </div>
                  )}
                </div>

                {/* Assigned employees count */}
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />
                    الموظفون المرتبطون:
                  </span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                    {empCount} موظف
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {hasPermission('hr', 'edit') && (
                  <button
                    onClick={() => handleOpenAssign(shift)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                    title="تحديد وتعيين الموظفين التابعين لهذا الجدول"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    تعيين موظفين
                  </button>
                )}

                <div className="flex items-center gap-1">
                  {hasPermission('hr', 'edit') && (
                    <button
                      onClick={() => handleEdit(shift)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                      title="تعديل الوردية"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {hasPermission('hr', 'delete') && !shift.isDefault && (
                    <button
                      onClick={() => handleDelete(shift)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Shift Modal */}
      {editingShift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                {isNewShift ? 'إنشاء جدول عمل جديد' : `تعديل: ${editingShift.name}`}
              </h3>
              <button
                onClick={() => setEditingShift(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم جدول العمل / الوردية *</label>
                <input
                  type="text"
                  placeholder="مثال: دوام كامل، دوام صباحي، دوام ورشة، دوام رمضان..."
                  value={editingShift.name}
                  onChange={e => setEditingShift({ ...editingShift, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وقت بدء الدوام *</label>
                  <input
                    type="time"
                    value={editingShift.startTime}
                    onChange={e => setEditingShift({ ...editingShift, startTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وقت نهاية الدوام *</label>
                  <input
                    type="time"
                    value={editingShift.endTime}
                    onChange={e => setEditingShift({ ...editingShift, endTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سماح التأخير (دقيقة)</label>
                  <input
                    type="number"
                    value={editingShift.lateGraceMinutes}
                    onChange={e => setEditingShift({ ...editingShift, lateGraceMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سماح الخروج المبكر (دقيقة)</label>
                  <input
                    type="number"
                    value={editingShift.earlyGraceMinutes}
                    onChange={e => setEditingShift({ ...editingShift, earlyGraceMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأدنى للإضافي (دقيقة)</label>
                  <input
                    type="number"
                    placeholder="افتراضي المنظومة"
                    value={editingShift.minOvertimeMinutes !== undefined && editingShift.minOvertimeMinutes !== null ? editingShift.minOvertimeMinutes : ''}
                    onChange={e => setEditingShift({
                      ...editingShift,
                      minOvertimeMinutes: e.target.value === '' ? undefined : Number(e.target.value)
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">اتركه فارغاً لاعتماد القاعدة العامة</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأعلى للإضافي اليومي (ساعة)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="افتراضي المنظومة"
                    value={editingShift.maxDailyOvertimeHours !== undefined && editingShift.maxDailyOvertimeHours !== null ? editingShift.maxDailyOvertimeHours : ''}
                    onChange={e => setEditingShift({
                      ...editingShift,
                      maxDailyOvertimeHours: e.target.value === '' ? undefined : Number(e.target.value)
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">اتركه فارغاً لاعتماد القاعدة العامة</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ساعات خصم البصمة الناقصة / المفردة (ساعة تأخير)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="افتراضي المنظومة (3 ساعات)"
                  value={editingShift.missingPunchPenaltyHours !== undefined && editingShift.missingPunchPenaltyHours !== null ? editingShift.missingPunchPenaltyHours : ''}
                  onChange={e => setEditingShift({
                    ...editingShift,
                    missingPunchPenaltyHours: e.target.value === '' ? undefined : Number(e.target.value)
                  })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">اتركه فارغاً لاعتماد القاعدة العامة في الإعدادات (3 ساعات تأخير)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ساعات العمل المقررة</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingShift.workHours}
                    onChange={e => setEditingShift({ ...editingShift, workHours: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">لون التمييز</label>
                  <input
                    type="color"
                    value={editingShift.color || '#2563eb'}
                    onChange={e => setEditingShift({ ...editingShift, color: e.target.value })}
                    className="w-full h-[42px] p-1 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              {/* Split Shift Configuration */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingShift.isSplitShift || false}
                    onChange={e => setEditingShift({ ...editingShift, isSplitShift: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      جدول مقسم لفترتين مع استراحة وسطية (Split Shift)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      مثل دوام 09:00 إلى 18:00 يتخلله استراحة من 13:00 إلى 14:00
                    </p>
                  </div>
                </label>

                {editingShift.isSplitShift && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">بداية الاستراحة (خروج الفترة 1)</label>
                      <input
                        type="time"
                        value={editingShift.splitBreakStart || '13:00'}
                        onChange={e => setEditingShift({ ...editingShift, splitBreakStart: e.target.value })}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">نهاية الاستراحة (دخول الفترة 2)</label>
                      <input
                        type="time"
                        value={editingShift.splitBreakEnd || '14:00'}
                        onChange={e => setEditingShift({ ...editingShift, splitBreakEnd: e.target.value })}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={editingShift.isDefault}
                    onChange={e => setEditingShift({ ...editingShift, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    تعيين كجدول عمل افتراضي لأي موظف جديد
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="ملاحظات حول طبيعة الوردية..."
                  value={editingShift.notes || ''}
                  onChange={e => setEditingShift({ ...editingShift, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  onClick={() => setEditingShift(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveModal}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs"
                >
                  حفظ الجدول
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Employees Modal */}
      {assigningShift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                  تعيين الموظفين لجدول: {assigningShift.name} ({assigningShift.startTime}-{assigningShift.endTime})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  حدد الموظفين الذين سيتم تطبيق هذا الجدول عليهم لاحتساب حضورهم وتأخيرهم
                </p>
              </div>
              <button
                onClick={() => setAssigningShift(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
              <span className="text-xs font-bold text-slate-700">
                المحددون حالياً: <span className="text-blue-600 font-mono text-sm">{selectedEmpIds.length}</span> من أصل {employees.length}
              </span>
              <button
                onClick={toggleSelectAll}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                {selectedEmpIds.length === employees.length ? 'إلغاء تحديد الكل' : 'تحديد جميع الموظفين'}
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {employees.map(emp => {
                  const isChecked = selectedEmpIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
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
                            setSelectedEmpIds(selectedEmpIds.filter(id => id !== emp.id));
                          } else {
                            setSelectedEmpIds([...selectedEmpIds, emp.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{emp.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <span>بصمة #{emp.badgeNumber || emp.id}</span>
                          <span>•</span>
                          <span>{emp.deptName || 'عام'}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5 flex-shrink-0">
              <button
                onClick={() => setAssigningShift(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl border border-slate-200"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveAssignment}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs"
              >
                حفظ التعيين
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
