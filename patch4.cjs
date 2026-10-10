const fs = require('fs');

let content = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8');

// 1. Replace states
content = content.replace(
  /const \[filterSection, setFilterSection\] = useState\(''\);/,
  `const [expandedSections, setExpandedSections] = useState<string[]>([]);`
);

// 2. Fix sortedAndFilteredMaterials (remove filterSection references)
content = content.replace(
  /if \(filterSection !== ''\) \{\n\s*result = result\.filter\(m => m\.worksOfIds && m\.worksOfIds\.includes\(filterSection\)\);\n\s*\}/,
  ''
);
content = content.replace(
  /\[masterMaterials, sortConfig, filterSection\]/,
  '[masterMaterials, sortConfig]'
);

// 3. Extract the existing table and grid markup so we don't have to duplicate the logic.
// We'll wrap the `return` block.
// Find the exact line: `return (\n      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-5xl mx-auto">`
const returnStatement = 'return (\n      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-5xl mx-auto">';
const returnIdx = content.indexOf(returnStatement);

const renderBlock = `
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
                          <button onClick={() => setTaggingId(taggingId === mm.id ? null : mm.id)} className={\`p-2 rounded \${taggingId === mm.id ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50 hover:bg-purple-100'}\`} title="ربط بأقسام العمل وتصنيف المادة"><Package className="w-4 h-4" /></button>
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
                                  className={\`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 \${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}\`}
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
          ))}
        </div>
      );
    };

    const categoriesToRender = [
      ...worksOf.map(w => ({ id: w.id, name: w.name, materials: sortedAndFilteredMaterials.filter(m => m.worksOfIds?.includes(w.id)) })),
      { id: 'uncategorized', name: 'مواد غير مصنفة', materials: sortedAndFilteredMaterials.filter(m => !m.worksOfIds || m.worksOfIds.length === 0) }
    ].filter(cat => cat.materials.length > 0);
`;

const newAccordionJSX = `
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
`;

// Insert render block before return
content = content.replace(returnStatement, renderBlock + '\n    ' + returnStatement);

// Remove filterSection select box
content = content.replace(/<select className="border border-slate-300[^>]*?value=\{filterSection\}[^>]*?>[\s\S]*?<\/select>/, '');

// Replace old container with accordion JSX
const startSearch = `<div className="overflow-hidden rounded-lg border border-slate-200">`;
const endSearch = `</div>\n      </div>\n    );\n  };\n`;
const startIdx = content.indexOf(startSearch);
const endIdx = content.lastIndexOf(endSearch);

if (startIdx > -1 && endIdx > -1) {
  content = content.substring(0, startIdx) + newAccordionJSX + endSearch;
}

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', content);
