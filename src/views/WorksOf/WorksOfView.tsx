import React, { useState } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useMaterials } from '../../context/MaterialsContext';
import { Settings, Plus, Trash2, Edit, Save, X, Search, Check, ArrowUp, ArrowDown, MoveUp, MoveDown } from 'lucide-react';

export const WorksOfView = ({ selectedWorkId, setSelectedWorkId }) => {
    const { worksOf, setWorksOf, masterItems, setMasterItems } = useMaterials();
    const { hasPermission } = useAuth();
    const [wName, setWName] = useState('');
    const [itemName, setItemName] = useState('');
    const [editingWorkId, setEditingWorkId] = useState(null);
    const [editWorkName, setEditWorkName] = useState('');
    const [editingItemId, setEditingItemId] = useState(null);
    const [editItemName, setEditItemName] = useState('');

    const addWorkOf = () => { 
      if (!hasPermission('worksOf', 'create')) return alert('ليس لديك صلاحية لإضافة قسم'); if (!wName) return; setWorksOf([...worksOf, { id: `W${Date.now()}`, name: wName, orderIndex: worksOf.length }]); setWName(''); };
    const addItem = () => { 
      if (!hasPermission('worksOf', 'create')) return alert('ليس لديك صلاحية لإضافة عنصر'); if (!itemName || !selectedWorkId) return; setMasterItems([...masterItems, { id: `I${Date.now()}`, worksOfId: selectedWorkId, name: itemName, orderIndex: masterItems.length }]); setItemName(''); };

    const moveWorkUp = (idx) => {
      if (idx === 0) return;
      const newWorks = [...worksOf];
      [newWorks[idx - 1], newWorks[idx]] = [newWorks[idx], newWorks[idx - 1]];
      setWorksOf(newWorks.map((w, i) => ({ ...w, orderIndex: i })));
    };

    const moveWorkDown = (idx) => {
      if (idx === worksOf.length - 1) return;
      const newWorks = [...worksOf];
      [newWorks[idx + 1], newWorks[idx]] = [newWorks[idx], newWorks[idx + 1]];
      setWorksOf(newWorks.map((w, i) => ({ ...w, orderIndex: i })));
    };

    const saveWorkEdit = (id) => {
      if (!editWorkName) return;
      setWorksOf(worksOf.map(w => w.id === id ? { ...w, name: editWorkName } : w));
      setEditingWorkId(null);
    };

    const sectionItems = masterItems.filter(i => i.worksOfId === selectedWorkId);

    const moveItemUp = (idx) => {
      if (idx === 0) return;
      const itemsWithoutSection = masterItems.filter(i => i.worksOfId !== selectedWorkId);
      const newSectionItems = [...sectionItems];
      [newSectionItems[idx - 1], newSectionItems[idx]] = [newSectionItems[idx], newSectionItems[idx - 1]];
      setMasterItems([...itemsWithoutSection, ...newSectionItems.map((item, i) => ({ ...item, orderIndex: i }))]);
    };

    const moveItemDown = (idx) => {
      if (idx === sectionItems.length - 1) return;
      const itemsWithoutSection = masterItems.filter(i => i.worksOfId !== selectedWorkId);
      const newSectionItems = [...sectionItems];
      [newSectionItems[idx + 1], newSectionItems[idx]] = [newSectionItems[idx], newSectionItems[idx + 1]];
      setMasterItems([...itemsWithoutSection, ...newSectionItems.map((item, i) => ({ ...item, orderIndex: i }))]);
    };

    const saveItemEdit = (id) => {
      if (!editItemName) return;
      setMasterItems(masterItems.map(i => i.id === id ? { ...i, name: editItemName } : i));
      setEditingItemId(null);
    };

    return (
      <div className="max-w-6xl mx-auto flex gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> إدارة أقسام الأعمال (أعمال الـ)</h2>
          {hasPermission('worksOf', 'create') && <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4 items-end">
            <div className="flex-1"><label className="block text-sm font-medium text-slate-700 mb-1">اسم قسم العمل (مثال: الهيكل المعدني)</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none" value={wName} onChange={e => setWName(e.target.value)} /></div>
            {hasPermission('worksOf', 'create') && <button onClick={addWorkOf} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">إضافة قسم</button>}
          </div>}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr><th className="p-4 w-16 text-center">#</th><th className="p-4">اسم القسم</th><th className="p-4 w-48 text-center">إجراء</th></tr>
              </thead>
              <tbody>
                {worksOf.map((w, idx) => (
                  <tr key={w.id} className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedWorkId === w.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`} onClick={() => setSelectedWorkId(w.id)}>
                    <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-4">
                      {editingWorkId === w.id ? (
                        <input type="text" className="w-full p-1.5 border border-blue-300 rounded outline-none font-bold" value={editWorkName} onChange={e => setEditWorkName(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
                      ) : (
                        <span className="font-bold text-slate-700">{w.name}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {editingWorkId === w.id ? (
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); saveWorkEdit(w.id); }} className="bg-emerald-100 text-emerald-700 p-1.5 rounded hover:bg-emerald-200"><Check className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingWorkId(null); }} className="bg-slate-100 text-slate-600 p-1.5 rounded hover:bg-slate-200"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); moveWorkUp(idx); }} disabled={idx === 0} className={`p-1.5 rounded ${idx === 0 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-200'}`}><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveWorkDown(idx); }} disabled={idx === worksOf.length - 1} className={`p-1.5 rounded ${idx === worksOf.length - 1 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-200'}`}><ArrowDown className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditWorkName(w.name); setEditingWorkId(w.id); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); if (window.confirm('هل أنت متأكد من الحذف؟')) { setWorksOf(worksOf.filter(x => x.id !== w.id)); setMasterItems(masterItems.filter(i => i.worksOfId !== w.id)); if (selectedWorkId === w.id) setSelectedWorkId(null); } }} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          </div>
        </div>

        {selectedWorkId && (
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">بنود العمل التابعة لـ: <span className="text-blue-600">{worksOf.find(w => w.id === selectedWorkId)?.name}</span></h2>
            {hasPermission('worksOf', 'create') && <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4 items-end">
              <div className="flex-1"><label className="block text-sm font-medium text-slate-700 mb-1">اسم البند (مثال: تصنيع القاعدة)</label><input type="text" className="w-full p-2 border border-slate-300 rounded outline-none" value={itemName} onChange={e => setItemName(e.target.value)} /></div>
              <button onClick={addItem} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700">إضافة بند</button>
            </div>}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr><th className="p-4 w-16 text-center">#</th><th className="p-4">اسم البند</th><th className="p-4 w-48 text-center">إجراء</th></tr>
                </thead>
                <tbody>
                  {sectionItems.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-4">
                        {editingItemId === item.id ? (
                          <input type="text" className="w-full p-1.5 border border-blue-300 rounded outline-none font-bold" value={editItemName} onChange={e => setEditItemName(e.target.value)} autoFocus />
                        ) : (
                          <span className="font-bold text-slate-700">{item.name}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {editingItemId === item.id ? (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => saveItemEdit(item.id)} className="bg-emerald-100 text-emerald-700 p-1.5 rounded hover:bg-emerald-200"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingItemId(null)} className="bg-slate-100 text-slate-600 p-1.5 rounded hover:bg-slate-200"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => moveItemUp(idx)} disabled={idx === 0} className={`p-1.5 rounded ${idx === 0 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-200'}`}><ArrowUp className="w-4 h-4" /></button>
                            <button onClick={() => moveItemDown(idx)} disabled={idx === sectionItems.length - 1} className={`p-1.5 rounded ${idx === sectionItems.length - 1 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-200'}`}><ArrowDown className="w-4 h-4" /></button>
                            <button onClick={() => { setEditItemName(item.name); setEditingItemId(item.id); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => { if (window.confirm('هل أنت متأكد من الحذف؟')) setMasterItems(masterItems.filter(x => x.id !== item.id)); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sectionItems.length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-slate-400">لا توجد بنود مضافة في هذا القسم</td></tr>
                  )}
                </tbody>
              </table>
</div>
            </div>
          </div>
        )}
      </div>
    );
  };


