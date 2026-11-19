import React, { useState } from 'react';
import { useAuth, PAGE_PERMISSIONS, ACTION_LABELS } from '../../context/AuthContext';
import type { User } from '../../context/AuthContext';
import { UserCog, Plus, Edit, Trash2, Save, X, Check, Shield, ShieldOff, Eye, EyeOff, KeyRound, FileSignature, Stamp, Upload, LayoutDashboard, Layers, Zap } from 'lucide-react';

const EMPTY_FORM = {
  username: '',
  displayName: '',
  password: '',
  role: 'user' as 'admin' | 'user',
  jobTitle: '',
  signature: '',
  stamp: '',
  permissions: {} as Record<string, string[]>,
};

export const UsersView = () => {
  const { users, addUser, updateUser, deleteUser, currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('users', 'manage');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
  };

  const handleImageUpload = (field: 'signature' | 'stamp', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الصورة كبير، يرجى اختيار صورة أصغر من 3 ميغابايت');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, [field]: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const startEdit = (u: User) => {
    if (!canManage) return alert('ليس لديك صلاحية لتعديل المستخدمين');
    setEditingId(u.id);
    let perms = u.permissions;
    // Migration fallback for edit
    if (!perms) {
      perms = {};
      (u.allowedPages || []).forEach(p => { perms[p] = PAGE_PERMISSIONS[p]?.actions || ['view']; });
    }
    // Backward compatibility: If user previously had 'view' on dashboard without granular sub-permissions, default to all dashboard actions
    if (perms.dashboard && perms.dashboard.includes('view')) {
      const hasGranular = perms.dashboard.some(a => 
        (a.startsWith('view_') && a !== 'view_financials') || a.startsWith('qa_')
      );
      if (!hasGranular) {
        perms = {
          ...perms,
          dashboard: [...PAGE_PERMISSIONS.dashboard.actions]
        };
      }
    }
    setForm({
      username: u.username,
      displayName: u.displayName,
      password: u.password,
      role: u.role,
      jobTitle: u.jobTitle || '',
      signature: u.signature || '',
      stamp: u.stamp || '',
      permissions: perms
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAction = (pageId: string, action: string) => {
    setForm(f => {
      const pagePerms = f.permissions[pageId] || [];
      let newPerms = [...pagePerms];

      if (newPerms.includes(action)) {
        newPerms = newPerms.filter(a => a !== action);
        // If view is removed, remove all other actions
        if (action === 'view') newPerms = [];
      } else {
        newPerms.push(action);
        // If an action is added, ensure view is also added
        if (action !== 'view' && !newPerms.includes('view')) newPerms.push('view');
      }

      return {
        ...f,
        permissions: { ...f.permissions, [pageId]: newPerms }
      };
    });
  };

  const toggleAllPageActions = (pageId: string, enableAll: boolean) => {
    setForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [pageId]: enableAll ? [...(PAGE_PERMISSIONS[pageId]?.actions || [])] : []
      }
    }));
  };

  const handleSave = () => {
    if (!canManage) return setError('ليس لديك صلاحية لإضافة أو تعديل المستخدمين');
    if (!form.username.trim() || !form.password.trim() || !form.displayName.trim()) {
      return setError('يرجى ملء جميع الحقول المطلوبة');
    }
    const duplicate = users.find(u => u.username === form.username.trim() && u.id !== editingId);
    if (duplicate) return setError('اسم المستخدم مستخدم بالفعل');

    const finalPerms = form.role === 'admin' 
      ? Object.keys(PAGE_PERMISSIONS).reduce((acc, key) => ({ ...acc, [key]: PAGE_PERMISSIONS[key].actions }), {}) 
      : form.permissions;

    if (editingId) {
      updateUser({ id: editingId, ...form, permissions: finalPerms });
    } else {
      addUser({ ...form, permissions: finalPerms });
    }
    resetForm();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserCog className="w-7 h-7 text-slate-500" />
        <h2 className="text-2xl font-black text-slate-800">إدارة المستخدمين والصلاحيات</h2>
      </div>

      {!canManage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6 text-sm font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-600" />
          <span>لديك صلاحية عرض قائمة المستخدمين فقط دون إمكانية التعديل أو إضافة مستخدمين جدد.</span>
        </div>
      )}

      {canManage && (
        <div className={`bg-white rounded-2xl border shadow-sm mb-8 p-6 transition-all ${editingId ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'}`}>
          <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-5">
            {editingId ? <><Edit className="w-4 h-4 text-blue-500" /> تعديل مستخدم</> : <><Plus className="w-4 h-4 text-emerald-500" /> إضافة مستخدم جديد</>}
          </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">الاسم الظاهر <span className="text-red-500">*</span></label>
            <input type="text" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="مثال: أحمد محمد" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">الصفة / المسمى الوظيفي</label>
            <input type="text" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="مثال: المدير العام، مسؤول المبيعات، مسؤول الحركة" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">اسم المستخدم <span className="text-red-500">*</span></label>
            <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="مثال: ahmed" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">كلمة المرور <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm pr-10" placeholder="أدخل كلمة المرور" dir="ltr" />
              <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-slate-600 mb-1">الدور والصلاحيات العامة</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, role: 'admin' }))} className={`flex-1 py-2.5 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-colors ${form.role === 'admin' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                <Shield className="w-4 h-4" /> مدير (تحكم كامل)
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, role: 'user' }))} className={`flex-1 py-2.5 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-colors ${form.role === 'user' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
                <ShieldOff className="w-4 h-4" /> مستخدم مخصص
              </button>
            </div>
          </div>
        </div>

        {/* التوقيع والختم الرقمي */}
        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-blue-600" />
            التوقيع والختم الرقمي للمستخدم (يظهر تلقائياً في الفواتير وأوامر النقل والمراسلات)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Signature Upload */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-blue-500" /> صورة التوقيع (Signature)
                </div>
                <div className="text-[11px] text-slate-400 mb-3">صورة واضحة لتوقيع المستخدم بصيغة PNG أو JPEG</div>
                {form.signature ? (
                  <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50/50 flex items-center justify-center h-28">
                    <img src={form.signature} alt="توقيع" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, signature: '' }))}
                      className="absolute top-1.5 left-1.5 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors shadow-xs"
                      title="حذف التوقيع"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center h-28 flex flex-col items-center justify-center">
                    <FileSignature className="w-6 h-6 text-slate-300 mb-1" />
                    <span className="text-xs text-slate-400">لا يوجد توقيع مسجل</span>
                  </div>
                )}
              </div>
              <label className="mt-3 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-300/80">
                <Upload className="w-3.5 h-3.5" />
                <span>{form.signature ? 'تغيير صورة التوقيع' : 'رفع صورة التوقيع'}</span>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload('signature', e)} className="hidden" />
              </label>
            </div>

            {/* Stamp Upload */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Stamp className="w-4 h-4 text-indigo-500" /> صورة الختم (Stamp)
                </div>
                <div className="text-[11px] text-slate-400 mb-3">صورة الختم الرسمي للمستخدم أو الإدارة (يفضل خلفية شفافة PNG)</div>
                {form.stamp ? (
                  <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50/50 flex items-center justify-center h-28">
                    <img src={form.stamp} alt="ختم" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, stamp: '' }))}
                      className="absolute top-1.5 left-1.5 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors shadow-xs"
                      title="حذف الختم"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center h-28 flex flex-col items-center justify-center">
                    <Stamp className="w-6 h-6 text-slate-300 mb-1" />
                    <span className="text-xs text-slate-400">لا يوجد ختم مسجل</span>
                  </div>
                )}
              </div>
              <label className="mt-3 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-300/80">
                <Upload className="w-3.5 h-3.5" />
                <span>{form.stamp ? 'تغيير صورة الختم' : 'رفع صورة الختم'}</span>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload('stamp', e)} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            صلاحيات الصفحات والإجراءات
            {form.role === 'admin' && <span className="text-indigo-600 text-xs font-bold mr-2">(المدير يملك كافة الصلاحيات تلقائياً)</span>}
          </label>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(PAGE_PERMISSIONS).map(([pageId, config]) => {
              const isAdmin = form.role === 'admin';
              const activeActions = form.permissions[pageId] || [];
              const allSelected = config.actions.length > 0 && config.actions.every(a => activeActions.includes(a));
              const hasAny = activeActions.length > 0;

              if (pageId === 'dashboard') {
                const infoActions = [
                  'view',
                  'view_stats',
                  'view_invoices_summary',
                  'view_purchases_summary',
                  'view_wo_movements',
                  'view_hr_card',
                  'view_recent_activity'
                ];
                const shortcutActions = [
                  'qa_estimates',
                  'qa_final_invoices',
                  'qa_work_orders',
                  'qa_shipping',
                  'qa_letters',
                  'view_hr_shortcuts'
                ];

                return (
                  <div
                    key={pageId}
                    className={`lg:col-span-2 border rounded-2xl p-5 transition-all shadow-xs ${
                      isAdmin
                        ? 'bg-slate-50 border-slate-200 opacity-70'
                        : hasAny
                        ? 'bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 border-indigo-200 ring-2 ring-indigo-100/60'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b border-slate-200/80 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
                          <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                            <span>{config.label}</span>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                              تخصيص البطاقات والاختصارات
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            اختر بدقة بطاقات المعلومات والإجماليات وأزرار الاختصارات التي تظهر لهذا المستخدم في لوحة التحكم
                          </p>
                        </div>
                      </div>

                      {!isAdmin && (
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => toggleAllPageActions(pageId, !allSelected)}
                            className="text-xs font-bold text-indigo-700 hover:bg-indigo-100/70 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200 cursor-pointer shadow-xs"
                          >
                            {allSelected ? 'إلغاء تحديد لوحة التحكم' : 'تحديد كافة بطاقات واختصارات لوحة التحكم'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* القسم الأول: بطاقات المعلومات والإجماليات */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                        <div className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <span>1. بطاقات المعلومات والإجماليات المعروضة</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {infoActions.map(action => {
                            const isSelected = isAdmin || activeActions.includes(action);
                            return (
                              <button
                                key={action}
                                type="button"
                                disabled={isAdmin}
                                onClick={() => toggleAction(pageId, action)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? isAdmin
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200 cursor-default'
                                      : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'border-transparent' : 'border-slate-400'}`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 text-current" />}
                                </div>
                                {ACTION_LABELS[action] || action}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* القسم الثاني: أزرار واختصارات الإجراءات السريعة */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                        <div className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <span>2. أزرار واختصارات الإجراءات السريعة</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {shortcutActions.map(action => {
                            const isSelected = isAdmin || activeActions.includes(action);
                            return (
                              <button
                                key={action}
                                type="button"
                                disabled={isAdmin}
                                onClick={() => toggleAction(pageId, action)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? isAdmin
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200 cursor-default'
                                      : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-white text-slate-500 border-slate-300 hover:border-emerald-400'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'border-transparent' : 'border-slate-400'}`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 text-current" />}
                                </div>
                                {ACTION_LABELS[action] || action}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={pageId} className={`border rounded-xl p-4 transition-colors ${isAdmin ? 'bg-slate-50 border-slate-200 opacity-70' : hasAny ? 'bg-blue-50/30 border-blue-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                    <div className="font-bold text-slate-800">{config.label}</div>
                    {!isAdmin && (
                      <button onClick={() => toggleAllPageActions(pageId, !allSelected)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">
                        {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {config.actions.map(action => {
                      const isSelected = isAdmin || activeActions.includes(action);
                      return (
                        <button
                          key={action}
                          type="button"
                          disabled={isAdmin}
                          onClick={() => toggleAction(pageId, action)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? isAdmin ? 'bg-indigo-100 text-indigo-700 border-indigo-200 cursor-default' : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'border-transparent' : 'border-slate-400'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-current" />}
                          </div>
                          {ACTION_LABELS[action] || action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-bold mb-3">{error}</div>}

        <div className="flex gap-2">
          <button onClick={handleSave} className={`${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors`}>
            <Save className="w-4 h-4" /> {editingId ? 'حفظ التعديلات' : 'إضافة المستخدم'}
          </button>
          {editingId && (
            <button onClick={resetForm} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors">
              <X className="w-4 h-4" /> إلغاء
            </button>
          )}
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4">الاسم والصفة</th>
                <th className="p-4">اسم المستخدم</th>
                <th className="p-4 text-center">الدور</th>
                <th className="p-4 text-center">التوقيع والختم</th>
                <th className="p-4">إحصائية الصلاحيات</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const legacyPages = u.allowedPages || [];
                const perms = u.permissions || {};
                const pageCount = Object.keys(perms).filter(k => perms[k].length > 0).length || legacyPages.length;
                return (
                  <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${u.id === currentUser?.id ? 'bg-blue-50/30' : ''}`}>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <span>{u.displayName}</span>
                        {u.id === currentUser?.id && <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-bold">أنت</span>}
                      </div>
                      {u.jobTitle && <div className="text-xs text-slate-500 font-medium mt-0.5">{u.jobTitle}</div>}
                    </td>
                    <td className="p-4 font-mono text-slate-600" dir="ltr">{u.username}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.role === 'admin' ? '🛡 مدير' : 'مستخدم'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                        {u.signature ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 font-bold" title="التوقيع الرقمي مسجل">
                            <FileSignature className="w-3 h-3 text-blue-600" /> توقيع
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">بلا توقيع</span>
                        )}
                        {u.stamp ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 font-bold" title="الختم الرقمي مسجل">
                            <Stamp className="w-3 h-3 text-indigo-600" /> ختم
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">بلا ختم</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">
                      {u.role === 'admin' ? 'كافة الصلاحيات (تحكم كامل)' : `مصرح له بـ ${pageCount} أقسام`}
                    </td>
                    <td className="p-4 text-center">
                      {canManage || u.id === currentUser?.id ? (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => startEdit(u)} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition-colors" title="تعديل"><Edit className="w-4 h-4" /></button>
                          {canManage && u.id !== currentUser?.id && u.id !== 'admin-root' && (
                            <button onClick={() => { if(window.confirm('هل أنت متأكد من حذف المستخدم؟')) deleteUser(u.id); }} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors" title="حذف">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">عرض فقط</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
