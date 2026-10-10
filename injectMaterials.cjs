const fs = require('fs');
let c = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8');

if (!c.includes('useLocalStorage')) {
    c = "import { useLocalStorage } from '../../hooks/useLocalStorage';\n" + c;
}
if (!c.includes('List, Grid')) {
    c = c.replace('Package, Plus,', 'Package, Plus, List, Grid,');
}
if (!c.includes('materials_viewMode')) {
    c = c.replace('const [editingId, setEditingId] = useState(null);', "const [viewMode, setViewMode] = useLocalStorage('materials_viewMode', 'table');\n    const [editingId, setEditingId] = useState(null);");
}

const headerOld = `<h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> إدارة المواد الخام</h2>`;
const headerNew = `<h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> إدارة المواد الخام</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('table')} className={\`p-1.5 rounded-md transition-colors \${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}\`} title="عرض كجدول"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={\`p-1.5 rounded-md transition-colors \${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}\`} title="عرض كبطاقات"><Grid className="w-4 h-4" /></button>
          </div>`;
if (!c.includes("setViewMode('table')")) {
    c = c.replace(headerOld, headerNew);
}

const startT = `<div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto w-full">`;
const endT = `</table>
</div>
        </div>`;
const s1 = c.indexOf(startT);
const s2 = c.indexOf(endT);

if (s1 !== -1 && s2 !== -1 && !c.includes("viewMode === 'table' ? (")) {
    const tableBlock = c.substring(s1, s2 + endT.length);
    const tableOnly = `<div className="overflow-x-auto w-full">` + c.substring(s1 + startT.length, s2) + `</table>\n          </div>`;
    const cardsBlock = `          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {sortedAndFilteredMaterials.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد مواد تطابق خيارات التصفية.</div>
            ) : (
              sortedAndFilteredMaterials.map((mm, idx) => (
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
                        <button onClick={() => setTaggingId(taggingId === mm.id ? null : mm.id)} className={\`p-2 rounded flex-1 flex justify-center items-center gap-1 font-bold text-xs \${taggingId === mm.id ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50 hover:bg-purple-100'}\`} title="ربط بأقسام العمل"><Package className="w-4 h-4" /> ربط</button>
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
                              className={\`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 \${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}\`}
                            >
                              {isSelected && <Check className="w-3 h-3" />} {w.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>`;

    const finalBlock = `<div className="overflow-hidden rounded-lg border border-slate-200">\n          {viewMode === 'table' ? (\n${tableOnly}\n          ) : (\n${cardsBlock}\n          )}\n        </div>`;
    c = c.substring(0, s1) + finalBlock + c.substring(s2 + endT.length);
}

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', c);
console.log('Cards injected into MaterialsView');
