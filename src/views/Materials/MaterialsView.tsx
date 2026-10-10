import { useLocalStorage } from '../../hooks/useLocalStorage';
import React, { useState } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useMaterials } from '../../context/MaterialsContext';
import { Package, Plus, List, Grid, Trash2, Edit, Save, X, Search, ArrowUp, ArrowDown, Tags, Settings, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const MaterialsView = () => {
    const { masterMaterials, setMasterMaterials, worksOf } = useMaterials();
    const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useLocalStorage('materials_viewMode', 'table');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', shortName: '', price: '', unit: '' });
    const [newMatForm, setNewMatForm] = useState({ name: '', shortName: '', price: '', unit: '', worksOfIds: [] });
    
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [expandedSections, setExpandedSections] = useState<string[]>([]);
    const [taggingId, setTaggingId] = useState(null);

    const requestSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <span className="opacity-30 group-hover:opacity-60 inline-block align-middle mr-1"><ArrowUp className="w-3.5 h-3.5" /></span>;
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 inline-block align-middle mr-1" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 inline-block align-middle mr-1" />;
    };

    const sortedAndFilteredMaterials = React.useMemo(() => {
      let result = [...masterMaterials];
      if (sortConfig.key) {
        result.sort((a, b) => {
          let aVal = a[sortConfig.key] || '';
          let bVal = b[sortConfig.key] || '';
          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();
          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
      return result;
    }, [masterMaterials, sortConfig]);

    const toggleTag = (matId, workId) => {
      setMasterMaterials(masterMaterials.map(m => {
        if (m.id === matId) {
          const currentTags = m.worksOfIds || [];
          const newTags = currentTags.includes(workId) ? currentTags.filter(id => id !== workId) : [...currentTags, workId];
          return { ...m, worksOfIds: newTags };
        }
        return m;
      }));
    };

    const addMaterial = () => { 
      if (!hasPermission('materials', 'create')) return alert('ليس لديك صلاحية لإضافة مادة');
      if (!newMatForm.name || !newMatForm.price) return;
      
      let finalTags = [...newMatForm.worksOfIds];

      setMasterMaterials([...masterMaterials, { 
        id: Date.now(), 
        name: newMatForm.name, 
        shortName: newMatForm.shortName, 
        defaultPrice: Number(newMatForm.price), 
        unit: newMatForm.unit || 'قطعة',
        worksOfIds: finalTags
      }]);
      setNewMatForm({ name: '', shortName: '', price: '', unit: '', worksOfIds: [] });
    };

    const saveEdit = (id) => { 
      if (!hasPermission('materials', 'edit')) return alert('ليس لديك صلاحية للتعديل');
      const newPrice = Number(editForm.price);
      setMasterMaterials(masterMaterials.map(mm => mm.id === id ? { ...mm, name: editForm.name, shortName: editForm.shortName, defaultPrice: newPrice, unit: editForm.unit } : mm));
      setEditingId(null);
    };

    const toggleSection = (id) => {
      setExpandedSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const renderMaterialsBlock = (mats, sectionId) => {
      if (mats.length === 0) return <div className="p-8 text-center text-slate-500 font-bold bg-white">لا توجد مواد مضافة في هذا القسم.</div>;
      
      return viewMode === 'table' ? (
        <div className="overflow-x-auto w-full bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4 w-16 text-center cursor-pointer group select-none" onClick={() => requestSort('id')}># {getSortIcon('id')}</th>
                <th className="p-4 cursor-pointer group select-none" onClick={() => requestSort('name')}>الاسم الكامل للمادة {getSortIcon('name')}</th>
                <th className="p-4 w-40 text-center cursor-pointer group select-none" onClick={() => requestSort('shortName')}>الاسم المختصر {getSortIcon('shortName')}</th>
                <th className="p-4 w-32 text-center cursor-pointer group select-none" onClick={() => requestSort('unit')}>الوحدة {getSortIcon('unit')}</th>
                <th className="p-4 w-48 text-center cursor-pointer group select-none" onClick={() => requestSort('defaultPrice')}>السعر الافتراضي {getSortIcon('defaultPrice')}</th>
                <th className="p-4 w-48 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {mats.map((mm, idx) => (
                <React.Fragment key={mm.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-4">{editingId === mm.id ? <input type="text" className="w-full p-2 border border-blue-300 rounded outline-none" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /> : <span className="font-semibold text-slate-700">{mm.name}</span>}</td>
                    <td className="p-4 text-center">{editingId === mm.id ? <input type="text" className="w-full p-2 border border-blue-300 rounded outline-none text-center" placeholder="اختياري" value={editForm.shortName || ''} onChange={e => setEditForm({ ...editForm, shortName: e.target.value })} /> : <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">{mm.shortName || '-'}</span>}</td>
                    <td className="p-4 text-center">{editingId === mm.id ? <input type="text" className="w-full p-2 border border-blue-300 rounded outline-none text-center" value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} /> : <span className="font-semibold text-slate-700">{mm.unit || '-'}</span>}</td>
                    <td className="p-4 text-center">{editingId === mm.id ? <input type="number" className="w-full p-2 border border-blue-300 rounded outline-none text-center" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} /> : <span className="font-bold text-slate-700 dir-ltr inline-block">{formatCurrency(mm.defaultPrice)}</span>}</td>
                    <td className="p-4 text-center">
                      {editingId === mm.id ? (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => saveEdit(mm.id)} className="bg-emerald-100 text-emerald-700 p-2 rounded hover:bg-emerald-200" title="حفظ"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200" title="إلغاء"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setTaggingId(taggingId === mm.id ? null : mm.id)} className={`p-2 rounded ${taggingId === mm.id ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50 hover:bg-purple-100'}`} title="ربط بأقسام العمل وتصنيف المادة"><Package className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingId(mm.id); setEditForm({ name: mm.name, shortName: mm.shortName || '', price: mm.defaultPrice, unit: mm.unit || '' }); }} className="text-blue-600 bg-blue-50 p-2 rounded hover:bg-blue-100" title="تعديل المادة"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذه المادة؟')) setMasterMaterials(masterMaterials.filter(m => m.id !== mm.id)); }} className="text-red-500 bg-red-50 p-2 rounded hover:bg-red-100" title="حذف المادة"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {taggingId === mm.id && (
                    <tr className="bg-purple-50/50">
                      <td colSpan={6} className="p-4 border-b border-slate-200">
                        <div className="flex flex-col gap-3">
                          <span className="text-sm font-bold text-purple-800">ربط المادة "{mm.name}" بأقسام العمل:</span>
                          <div className="flex flex-wrap gap-2">
                            {worksOf.map(w => {
                              const isSelected = mm.worksOfIds?.includes(w.id);
                              return (
                                <button
                                  key={w.id}
                                  onClick={() => toggleTag(mm.id, w.id)}
                                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />} {w.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-white border-t border-slate-200">
          {mats.map((mm, idx) => (
            <div key={mm.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col relative">
              {editingId === mm.id ? (
                <div className="flex flex-col gap-2">
                  <input type="text" className="w-full p-2 border border-blue-300 rounded outline-none text-sm font-bold" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="الاسم الكامل" />
                  <div className="flex gap-2">
                    <input type="text" className="w-1/2 p-2 border border-blue-300 rounded outline-none text-sm" placeholder="الاسم المختصر" value={editForm.shortName || ''} onChange={e => setEditForm({ ...editForm, shortName: e.target.value })} />
                    <input type="text" className="w-1/2 p-2 border border-blue-300 rounded outline-none text-sm" placeholder="الوحدة" value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                  </div>
                  <input type="number" className="w-full p-2 border border-blue-300 rounded outline-none text-sm dir-ltr" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} placeholder="السعر" />
                  <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => saveEdit(mm.id)} className="bg-emerald-100 text-emerald-700 p-2 rounded hover:bg-emerald-200 flex-1 flex justify-center items-center gap-1 font-bold"><Check className="w-4 h-4" /> حفظ</button>
                    <button onClick={() => setEditingId(null)} className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200 flex items-center justify-center font-bold px-3"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-xs">#{idx + 1}</span>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight">{mm.name}</h3>
                    </div>
                    <span className="font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded text-xs">{mm.shortName || '-'}</span>
                  </div>
                  <div className="flex-1 space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-bold">الوحدة:</span>
                      <span className="font-semibold text-slate-700">{mm.unit || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                      <span className="text-slate-500 font-bold text-xs uppercase">السعر الافتراضي:</span>
                      <span className="font-black text-slate-800 dir-ltr">{formatCurrency(mm.defaultPrice)}</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-auto">
                    <button onClick={() => setTaggingId(taggingId === mm.id ? null : mm.id)} className={`p-2 rounded flex-1 flex justify-center items-center gap-1 font-bold text-xs ${taggingId === mm.id ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50 hover:bg-purple-100'}`} title="ربط بأقسام العمل"><Package className="w-4 h-4" /> ربط</button>
                    <button onClick={() => { setEditingId(mm.id); setEditForm({ name: mm.name, shortName: mm.shortName || '', price: mm.defaultPrice, unit: mm.unit || '' }); }} className="text-blue-600 bg-blue-50 p-2 rounded hover:bg-blue-100" title="تعديل المادة"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذه المادة؟')) setMasterMaterials(masterMaterials.filter(m => m.id !== mm.id)); }} className="text-red-500 bg-red-50 p-2 rounded hover:bg-red-100" title="حذف المادة"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </>
              )}
              {taggingId === mm.id && (
                <div className="mt-3 pt-3 border-t border-purple-100 bg-purple-50/50 p-3 rounded-lg -mx-1 -mb-1 animate-in fade-in slide-in-from-top-2">
                  <span className="text-xs font-bold text-purple-800 block mb-2">ربط بـ:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {worksOf.map(w => {
                      const isSelected = mm.worksOfIds?.includes(w.id);
                      return (
                        <button
                          key={w.id}
                          onClick={() => toggleTag(mm.id, w.id)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}`}
                        >
                          {isSelected && <Check className="w-3 h-3" />} {w.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    };

    const categoriesToRender = [
      ...worksOf.map(w => ({ id: w.id, name: w.name, materials: sortedAndFilteredMaterials.filter(m => m.worksOfIds?.includes(w.id)) })),
      { id: 'uncategorized', name: 'مواد غير مصنفة', materials: sortedAndFilteredMaterials.filter(m => !m.worksOfIds || m.worksOfIds.length === 0) }
    ].filter(cat => cat.materials.length > 0);
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> إدارة المواد الخام</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول عرض كجدول"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات عرض كبطاقات"><Grid className="w-4 h-4" /></button>
          </div>
          
        </div>


        {hasPermission('materials', 'create') && <div className="mb-6 bg-slate-50 p-4 border border-slate-200 rounded-lg shadow-sm">
          <div className="flex flex-wrap md:flex-nowrap gap-2">
            <input type="text" placeholder="الاسم الكامل للمادة (مطلوب) الاسم الكامل للمادة (مطلوب) الاسم الكامل للمادة (مطلوب) (الاسم الكامل للمادة (مطلوب))" className="flex-1 p-2 border border-slate-300 rounded outline-none min-w-[200px]" value={newMatForm.name} onChange={e => setNewMatForm({ ...newMatForm, name: e.target.value })} />
            <input type="text" placeholder="الاسم المختصر الاسم المختصر" className="w-full md:w-32 p-2 border border-slate-300 rounded outline-none" value={newMatForm.shortName} onChange={e => setNewMatForm({ ...newMatForm, shortName: e.target.value })} />
            <input type="text" placeholder="الوحدة" className="w-full md:w-24 p-2 border border-slate-300 rounded outline-none" value={newMatForm.unit} onChange={e => setNewMatForm({ ...newMatForm, unit: e.target.value })} />
            <input type="number" placeholder="السعر (مطلوب) (السعر (مطلوب))" className="w-full md:w-32 p-2 border border-slate-300 rounded outline-none" value={newMatForm.price} onChange={e => setNewMatForm({ ...newMatForm, price: e.target.value })} />
            <button onClick={addMaterial} className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> إضافة</button>
          </div>
          {newMatForm.name.trim().length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
              <span className="text-sm font-bold text-purple-800 mb-3 block">اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها: اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها::</span>
              <div className="flex flex-wrap gap-2">
                {worksOf.map(w => {
                  const isSelected = newMatForm.worksOfIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        const newIds = isSelected ? newMatForm.worksOfIds.filter(id => id !== w.id) : [...newMatForm.worksOfIds, w.id];
                        setNewMatForm({ ...newMatForm, worksOfIds: newIds });
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />} {w.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>}

        <div className="space-y-4">
          {categoriesToRender.map(category => (
            <div key={category.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all">
              <button 
                onClick={() => toggleSection(category.id)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-right outline-none focus:bg-slate-100"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-slate-500" />
                  <span className="font-bold text-slate-800 text-lg">{category.name}</span>
                  <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">{category.materials.length} مواد</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">{expandedSections.includes(category.id) ? 'طي' : 'عرض'}</span>
                  {expandedSections.includes(category.id) ? <ArrowUp className="w-5 h-5 text-slate-400" /> : <ArrowDown className="w-5 h-5 text-slate-400" />}
                </div>
              </button>
              {expandedSections.includes(category.id) && (
                <div className="border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                  {renderMaterialsBlock(category.materials, category.id)}
                </div>
              )}
            </div>
          ))}
          {categoriesToRender.length === 0 && (
            <div className="p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <div className="text-lg font-bold text-slate-500">لا توجد مواد مضافة حتى الآن.</div>
            </div>
          )}
        </div>
      </div>
    );
  };
