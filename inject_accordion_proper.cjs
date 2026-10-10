const fs = require('fs');

const newAccordionJSX = `        <div className="space-y-4">
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
        </div>`;

let lines = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8').split(/\r?\n/);

lines.splice(125, 145, newAccordionJSX);

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', lines.join('\n'));
console.log('Injected accordion!');
