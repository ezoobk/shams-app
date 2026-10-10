import React, { useState } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { Users, Trash2, Edit, Save, X } from 'lucide-react';
import { useCustomers } from '../../context/CustomersContext';

export const CustomersView = () => {
  const { customers, setCustomers } = useCustomers();
  const { hasPermission } = useAuth();
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const addCustomer = () => { 
    if (!hasPermission('customers', 'create')) return alert('ليس لديك صلاحية لإضافة عميل جديد');
    if (!cName) return; 
    setCustomers([{ id: `C${Date.now()}`, name: cName, phone: cPhone, notes: '' }, ...customers]); 
    setCName(''); 
    setCPhone(''); 
  };
  
  const saveEditedCustomer = () => {
    if (!editingCustomer.name) return alert('الرجاء إدخال اسم العميل');
    setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c));
    setEditingCustomer(null);
  };

  return (
    <div className="max-w-4xl mx-auto relative">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="w-6 h-6 text-slate-500" /> إدارة العملاء</h2>
      
      {hasPermission('customers', 'create') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full"><label className="block text-sm font-medium text-slate-700 mb-1">اسم العميل / الشركة</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none" value={cName} onChange={e => setCName(e.target.value)} /></div>
          <div className="flex-1 w-full"><label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none" value={cPhone} onChange={e => setCPhone(e.target.value)} /></div>
          <button onClick={addCustomer} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 w-full md:w-auto h-[42px]">إضافة عميل</button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr><th className="p-4">اسم العميل</th><th className="p-4">رقم الهاتف</th><th className="p-4 w-32 text-center">الإجراءات</th></tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 font-bold">{c.name}</td>
                <td className="p-4 font-mono">{c.phone}</td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-1">
                    {hasPermission('customers', 'edit') && (
                      <button onClick={() => setEditingCustomer(c)} className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 p-2 rounded transition-colors" title="تعديل">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {hasPermission('customers', 'delete') && (
                      <button onClick={() => { if(window.confirm('هل أنت متأكد من حذف العميل؟')) setCustomers(customers.filter(x => x.id !== c.id))}} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-slate-500">لا يوجد عملاء مضافين.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">تعديل بيانات العميل</h3>
              <button onClick={() => setEditingCustomer(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-right">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم العميل / الشركة</label>
                <input type="text" value={editingCustomer.name || ''} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input type="text" value={editingCustomer.phone || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end">
              <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 rounded font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">إلغاء</button>
              <button onClick={saveEditedCustomer} className="px-6 py-2 rounded font-bold text-white bg-blue-600 hover:bg-blue-700 shadow flex items-center gap-2"><Save className="w-4 h-4" /> حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
