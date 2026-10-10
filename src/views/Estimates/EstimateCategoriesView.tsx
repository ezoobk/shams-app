import React, { useState, useEffect, useRef } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useCustomers } from '../../context/CustomersContext';
import { Calculator, Plus, Trash2, Edit, Save, FileText, Check, Printer, X, Eye, EyeOff, LayoutDashboard, Database, Tags, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';

export const EstimateCategoriesView = () => {
    const { estimates, setEstimates, estimateCategories, setEstimateCategories, cart, setCart, editingEstimate, setEditingEstimate, editingContext, setEditingContext, calculatorDraftRef } = useEstimates();
    const { hasPermission } = useAuth();
    const { appSettings, setAppSettings, idCountersRef, generateId } = useSettings();
    const { printData, setPrintData } = usePrint();
    const { masterMaterials, setMasterMaterials, worksOf, setWorksOf, masterItems, setMasterItems } = useMaterials();
    const { customers, setCustomers } = useCustomers();
    const [catName, setCatName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const addCategory = () => { 
      if (!hasPermission('estimateCategories', 'create')) return alert('ليس لديك صلاحية لإضافة تصنيف');
      if (!catName.trim()) return;
      setEstimateCategories([...estimateCategories, { id: `cat${Date.now()}`, name: catName.trim() }]);
      setCatName('');
    };

    const saveEdit = (id) => { 
      if (!hasPermission('estimateCategories', 'edit')) return alert('ليس لديك صلاحية للتعديل');
      if (!editName.trim()) return;
      setEstimateCategories(estimateCategories.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
      setEditingId(null);
      setEditName('');
    };

    const deleteCategory = (id) => { 
      if (!hasPermission('estimateCategories', 'delete')) return alert('ليس لديك صلاحية للحذف');
      if (estimates.some(e => e.categoryId === id)) {
        alert('لا يمكن حذف هذا التصنيف لأنه مستخدم في تقديرات سابقة. قم بتغيير تصنيف التقديرات المرتبطة به أولاً.');
        return;
      }
      if (window.confirm('هل أنت متأكد من حذف هذا التصنيف؟')) {
        setEstimateCategories(estimateCategories.filter(c => c.id !== id));
      }
    };

    return (
      <div className="max-w-4xl mx-auto pb-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Tags className="w-6 h-6 text-slate-500" /> إدارة تصنيفات المنتجات (التقديرات)</h2>
        
        {hasPermission('estimateCategories', 'create') && <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">إضافة تصنيف جديد</h3>
          <div className="flex gap-4">
            <input type="text" placeholder="اسم التصنيف (مثال: مقطورات سكنية)" className="flex-1 p-3 border border-slate-300 rounded outline-none focus:border-blue-500" value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} />
            {hasPermission('estimateCategories', 'create') && <button onClick={addCategory} className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 whitespace-nowrap flex items-center gap-2"><Plus className="w-5 h-5" /> إضافة</button>}
          </div>
        </div>}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
<table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="p-4 w-16 text-center">#</th>
                <th className="p-4">اسم التصنيف</th>
                <th className="p-4 w-32 text-center">التقديرات المرتبطة</th>
                <th className="p-4 w-32 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimateCategories.map((cat, idx) => {
                const usedCount = estimates.filter(e => e.categoryId === cat.id).length;
                return (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-4">
                      {editingId === cat.id ? (
                        <div className="flex gap-2">
                          <input autoFocus type="text" className="flex-1 border border-blue-300 rounded px-2 py-1 outline-none font-bold" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(cat.id)} />
                          <button onClick={() => saveEdit(cat.id)} className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 rounded font-bold text-sm">حفظ</button>
                          <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-700 bg-slate-100 px-2 rounded font-bold text-sm">إلغاء</button>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-700 text-lg">{cat.name}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-mono bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full">{usedCount}</span>
                    </td>
                    <td className="p-4 text-center">
                      {editingId !== cat.id && (
                        <div className="flex justify-center gap-2">
                          <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded" title="تعديل"><Edit className="w-4 h-4" /></button>
                          {hasPermission('estimateCategories', 'delete') && <button onClick={() => deleteCategory(cat.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {estimateCategories.length === 0 && (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-medium">لا توجد تصنيفات حالياً.</td></tr>
              )}
            </tbody>
          </table>
</div>
        </div>
      </div>
    );
  };