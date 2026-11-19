import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Trash2, Edit, Save, X, Search, Phone, MapPin, FileText, Plus, ShoppingBag, Grid, List } from 'lucide-react';
import { useSuppliers } from '../../context/SuppliersContext';
import { usePurchases } from '../../context/PurchasesContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Supplier } from '../../types';

interface SuppliersViewProps {
  onViewSupplierInvoices?: (supplierIdOrName: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ onViewSupplierInvoices }) => {
  const { suppliers, setSuppliers } = useSuppliers();
  const { purchaseInvoices } = usePurchases();
  const { hasPermission } = useAuth();
  const [sName, setSName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sAddress, setSAddress] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useLocalStorage<'card' | 'table'>('shams_suppliers_view_mode', 'card');
  
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const getSupplierInvoicesCount = (s: Supplier) => {
    return purchaseInvoices.filter(inv => inv.supplierId === s.id || inv.supplierName === s.name).length;
  };

  const handleViewInvoices = (s: Supplier) => {
    if (onViewSupplierInvoices) {
      onViewSupplierInvoices(s.id || s.name);
    }
  };

  const addSupplier = () => { 
    if (!hasPermission('suppliers', 'create')) return alert('ليس لديك صلاحية لإضافة مورد جديد');
    if (!sName.trim()) return alert('الرجاء إدخال اسم المورد');
    
    const newSupplier: Supplier = {
      id: `S${Date.now()}`,
      name: sName.trim(),
      phone: sPhone.trim(),
      address: sAddress.trim(),
      notes: sNotes.trim()
    };

    setSuppliers([newSupplier, ...suppliers]); 
    setSName(''); 
    setSPhone(''); 
    setSAddress('');
    setSNotes('');
  };
  
  const saveEditedSupplier = () => {
    if (!hasPermission('suppliers', 'edit')) return alert('ليس لديك صلاحية لتعديل المورد');
    if (!editingSupplier || !editingSupplier.name.trim()) return alert('الرجاء إدخال اسم المورد');
    
    setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? editingSupplier : s));
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(s => {
    const q = searchTerm.toLowerCase();
    return !searchTerm ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.notes && s.notes.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-6xl mx-auto relative pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-blue-600" />
            إدارة الموردين
          </h1>
          <p className="text-sm text-slate-500 mt-1">سجل الموردين والشركات الموردة للمواد والمعدات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>بطاقات</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>جدول</span>
            </button>
          </div>

          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
            إجمالي الموردين: {suppliers.length}
          </span>
        </div>
      </div>
      
      {/* Add New Supplier Form */}
      {hasPermission('suppliers', 'create') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            إضافة مورد جديد
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">اسم المورد / الشركة *</label>
              <input
                type="text"
                placeholder="مثال: شركة الحديد والصلب"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm"
                value={sName}
                onChange={e => setSName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">رقم الهاتف</label>
              <input
                type="text"
                placeholder="09XXXXXXXX"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm font-mono text-right"
                value={sPhone}
                onChange={e => setSPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">العنوان / المدينة</label>
              <input
                type="text"
                placeholder="مثال: طرابلس - السواني"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm"
                value={sAddress}
                onChange={e => setSAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                placeholder="نشاط المورد أو أي تفاصيل"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm"
                value={sNotes}
                onChange={e => setSNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={addSupplier}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة المورد
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 mr-1" />
        <input
          type="text"
          placeholder="بحث بالاسم، رقم الهاتف، العنوان، أو الملاحظات..."
          className="w-full bg-transparent outline-none text-sm text-slate-700"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-red-500 p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suppliers Table or Cards */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s, idx) => {
            const invCount = getSupplierInvoicesCount(s);
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{s.name}</h3>
                        <span className="text-[11px] text-slate-400 font-mono">#{idx + 1}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {hasPermission('suppliers', 'edit') && (
                        <button
                          onClick={() => setEditingSupplier(s)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                          title="تعديل المورد"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('suppliers', 'delete') && (
                        <button
                          onClick={() => {
                            if (!hasPermission('suppliers', 'delete')) return alert('ليس لديك صلاحية لحذف المورد');
                            if (window.confirm(`هل أنت متأكد من حذف المورد "${s.name}"؟`)) {
                              setSuppliers(suppliers.filter(x => x.id !== s.id));
                            }
                          }}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="حذف المورد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-xs text-slate-600">
                    {s.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-mono font-semibold dir-ltr">{s.phone}</span>
                      </div>
                    ) : null}
                    {s.address ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    ) : null}
                    {s.notes ? (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-500 line-clamp-2">
                        {s.notes}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => handleViewInvoices(s)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-sm group"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                      <span>عرض فواتير المورد</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      invCount > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {invCount} {invCount === 1 ? 'فاتورة' : 'فواتير'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredSuppliers.length === 0 && (
            <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium">
              {searchTerm ? 'لا توجد نتائج تطابق بحثك' : 'لا يوجد موردون مضافون حالياً.'}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">اسم المورد / الشركة</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">العنوان</th>
                  <th className="p-4">ملاحظات</th>
                  <th className="p-4 text-center">فواتير المشتريات</th>
                  <th className="p-4 w-28 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s, idx) => {
                  const invCount = getSupplierInvoicesCount(s);
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-base">{s.name}</div>
                      </td>
                      <td className="p-4 font-mono text-slate-700">
                        {s.phone ? (
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {s.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600">
                        {s.address ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            {s.address}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 text-xs max-w-xs truncate" title={s.notes || ''}>
                        {s.notes || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleViewInvoices(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-sm group"
                          title={`عرض فواتير المشتريات الخاصة بـ ${s.name}`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                          <span>عرض الفواتير</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            invCount > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {invCount}
                          </span>
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1 items-center">
                          {hasPermission('suppliers', 'edit') && (
                            <button
                              onClick={() => setEditingSupplier(s)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                              title="تعديل المورد"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('suppliers', 'delete') && (
                            <button
                              onClick={() => {
                                if (!hasPermission('suppliers', 'delete')) return alert('ليس لديك صلاحية لحذف المورد');
                                if (window.confirm(`هل أنت متأكد من حذف المورد "${s.name}"؟`)) {
                                  setSuppliers(suppliers.filter(x => x.id !== s.id));
                                }
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="حذف المورد"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!hasPermission('suppliers', 'edit') && !hasPermission('suppliers', 'delete') && (
                            <span className="text-xs text-slate-400">عرض فقط</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-medium">
                      {searchTerm ? 'لا توجد نتائج تطابق بحثك' : 'لا يوجد موردون مضافون حالياً.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                تعديل بيانات المورد
              </h3>
              <button
                onClick={() => setEditingSupplier(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-right">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم المورد / الشركة *</label>
                <input
                  type="text"
                  value={editingSupplier.name || ''}
                  onChange={e => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={editingSupplier.phone || ''}
                  onChange={e => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">العنوان / المدينة</label>
                <input
                  type="text"
                  value={editingSupplier.address || ''}
                  onChange={e => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  rows={3}
                  value={editingSupplier.notes || ''}
                  onChange={e => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm resize-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end">
              <button
                onClick={() => setEditingSupplier(null)}
                className="px-4 py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={saveEditedSupplier}
                className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2 text-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
