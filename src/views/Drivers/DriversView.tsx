import React, { useState } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { Truck, Trash2, List, Grid, Edit, Save, X } from 'lucide-react';
import { useDrivers } from '../../context/DriversContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';

export const DriversView = () => {
  const { drivers, setDrivers } = useDrivers();
  const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useLocalStorage('drivers_viewMode', 'table');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dName, setDName] = useState('');
  const [dLicense, setDLicense] = useState('');
  const [dTruck, setDTruck] = useState('');
  const [dTrailer, setDTrailer] = useState('');

  const handleSaveDriver = () => { 
    if (!dName || !dTruck) return alert('يرجى إدخال اسم السائق ورقم السيارة'); 
    
    if (editingId) {
      if (!hasPermission('drivers', 'edit')) return alert('ليس لديك صلاحية لتعديل بيانات السائق');
      setDrivers(drivers.map(d => d.id === editingId ? { ...d, name: dName, license: dLicense, truckNumber: dTruck, trailerNumber: dTrailer } : d));
      setEditingId(null);
    } else {
      if (!hasPermission('drivers', 'create')) return alert('ليس لديك صلاحية لإضافة سائق جديد');
      setDrivers([{ id: `D${Date.now()}`, name: dName, license: dLicense, truckNumber: dTruck, trailerNumber: dTrailer }, ...drivers]); 
    }
    
    setDName(''); setDLicense(''); setDTruck(''); setDTrailer(''); 
  };

  const startEdit = (driver: any) => {
    if (!hasPermission('drivers', 'edit')) return alert('ليس لديك صلاحية لتعديل بيانات السائق');
    setEditingId(driver.id);
    setDName(driver.name);
    setDLicense(driver.license || '');
    setDTruck(driver.truckNumber);
    setDTrailer(driver.trailerNumber || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDName(''); setDLicense(''); setDTruck(''); setDTrailer('');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-6 h-6 text-slate-500" /> إدارة السائقين</h2>
        <div className="flex bg-slate-200 p-1 rounded-lg">
          <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول">
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات">
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {(hasPermission('drivers', 'create') || editingId) && (
        <div className={`bg-white p-6 rounded-xl border shadow-sm mb-8 flex flex-wrap gap-4 items-end transition-colors ${editingId ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'}`}>
          <div className="w-full mb-2">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              {editingId ? <><Edit className="w-4 h-4 text-blue-500"/> تعديل بيانات السائق</> : <><PlusIcon className="w-4 h-4 text-emerald-500"/> إضافة سائق جديد</>}
            </h3>
          </div>
          <div className="flex-1 min-w-[200px]"><label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل (مطلوب)</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={dName} onChange={e => setDName(e.target.value)} /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-medium text-slate-700 mb-1">رقم الرخصة</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={dLicense} onChange={e => setDLicense(e.target.value)} /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-medium text-slate-700 mb-1">رقم السيارة (مطلوب)</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={dTruck} onChange={e => setDTruck(e.target.value)} /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-medium text-slate-700 mb-1">رقم المقطورة (اختياري)</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={dTrailer} onChange={e => setDTrailer(e.target.value)} /></div>
          
          <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
            <button onClick={handleSaveDriver} className={`${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-6 py-2 rounded font-bold flex-1 md:flex-none flex items-center justify-center gap-2`}>
              {editingId ? <><Save className="w-4 h-4"/> حفظ التعديلات</> : 'إضافة سائق'}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded font-bold flex items-center justify-center gap-2">
                <X className="w-4 h-4"/> إلغاء
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {viewMode === 'table' ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4">اسم السائق</th>
                  <th className="p-4 text-center">رقم الرخصة</th>
                  <th className="p-4 text-center">رقم السيارة</th>
                  <th className="p-4 text-center">رقم المقطورة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${editingId === d.id ? 'bg-blue-50/50' : ''}`}>
                    <td className="p-4 font-bold text-slate-800">{d.name}</td>
                    <td className="p-4 text-center font-mono">{d.license || '-'}</td>
                    <td className="p-4 text-center font-mono font-bold text-slate-700 bg-slate-50/50">{d.truckNumber}</td>
                    <td className="p-4 text-center font-mono">{d.trailerNumber || '-'}</td>
                    <td className="p-4 text-center">
                      <div className="flex gap-2 justify-center">
                        {hasPermission('drivers', 'edit') && <button onClick={() => startEdit(d)} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition-colors" title="تعديل"><Edit className="w-4 h-4" /></button>}
                        {hasPermission('drivers', 'delete') && <button onClick={() => { if(window.confirm('متأكد من حذف هذا السائق؟')) setDrivers(drivers.filter(x => x.id !== d.id)); }} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {drivers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا يوجد سائقين مسجلين بعد.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50/50">
            {drivers.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا يوجد سائقين مسجلين بعد.</div>
            ) : (
              drivers.map(d => (
                <div key={d.id} className={`bg-white p-5 rounded-xl shadow-sm border transition-all hover:shadow-md flex flex-col ${editingId === d.id ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/10' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-lg"><Truck className="w-5 h-5 text-slate-500" /></div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{d.name}</h3>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-3 mb-4">
                    <div className="bg-slate-50 p-2 rounded-lg flex justify-between items-center">
                      <span className="text-xs uppercase font-bold text-slate-400">رقم السيارة</span>
                      <span className="font-mono font-bold text-slate-700 text-sm">{d.truckNumber}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 px-1">
                      <span className="text-slate-500 font-medium text-xs">رقم الرخصة</span>
                      <span className="font-mono font-semibold text-slate-700">{d.license || '—'}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm px-1">
                      <span className="text-slate-500 font-medium text-xs">رقم المقطورة</span>
                      <span className="font-mono font-semibold text-slate-700">{d.trailerNumber || '—'}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-auto">
                    {hasPermission('drivers', 'edit') && <button onClick={() => startEdit(d)} className="flex-1 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-colors"><Edit className="w-4 h-4" /> تعديل</button>}
                    {hasPermission('drivers', 'delete') && <button onClick={() => { if(window.confirm('متأكد من حذف هذا السائق؟')) setDrivers(drivers.filter(x => x.id !== d.id)); }} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper icon component for 'Plus' since it wasn't imported from lucide-react initially to avoid clutter
const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
