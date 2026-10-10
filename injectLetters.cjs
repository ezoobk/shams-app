const fs = require('fs');

const path = 'src/views/Letters/LettersView.tsx';
let content = fs.readFileSync(path, 'utf8');

const toolbarTarget = `<div className="flex justify-end gap-2 mb-4">
          <button onClick={() => setShowLegacyImport(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 text-sm flex items-center gap-2"><Database className="w-4 h-4" /> إدراج سجل خارجي</button>
          <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> إنشاء رسالة جديدة</button>
        </div>`;

const toolbarNew = `<div className="flex justify-between items-center mb-4">
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setViewMode('table')} className={\`p-1.5 rounded-md transition-colors \${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}\`} title="عرض كجدول">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('grid')} className={\`p-1.5 rounded-md transition-colors \${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}\`} title="عرض كبطاقات">
              <Grid className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowLegacyImport(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 text-sm flex items-center gap-2"><Database className="w-4 h-4" /> إدراج سجل خارجي</button>
            <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> إنشاء رسالة جديدة</button>
          </div>
        </div>`;

content = content.replace(toolbarTarget, toolbarNew);

// Now for the table part
const tableTargetStart = `<div className="overflow-x-auto w-full">
<table className="w-full text-right">`;
const tableTargetEnd = `            </tbody>
          </table>
</div>`;

const split1 = content.split(tableTargetStart);
const split2 = split1[1].split(tableTargetEnd);

const tableContent = tableTargetStart + split2[0] + tableTargetEnd;

const cardsContent = `          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50/50">
            {paginatedLetters.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد رسائل مطابقة.</div>
            ) : (
              paginatedLetters.map(letter => (
                <div key={letter.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                  <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{letter.id}</span>
                      <div className="text-xs text-slate-500 flex items-center gap-1 font-bold"><Calendar className="w-3 h-3" /> {new Date(letter.date).toLocaleDateString('ar-LY')}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setPrintData({ type: 'LETTER', data: letter })} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="طباعة / تصدير PDF"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => { if(window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) setLetters(letters.filter(l => l.id !== letter.id)) }} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase font-bold text-slate-400 mb-1">إلى السادة</div>
                    <div className="font-black text-slate-800 mb-3">{letter.customerName}</div>
                    <div className="text-xs uppercase font-bold text-slate-400 mb-1">الموضوع</div>
                    <div className="font-medium text-slate-700 text-sm leading-snug">{letter.subject}</div>
                  </div>
                </div>
              ))
            )}
          </div>`;

const newJSX = `{viewMode === 'table' ? (
${tableContent}
) : (
${cardsContent}
)}`;

content = split1[0] + newJSX + split2[1];

// Add viewMode state
content = content.replace("const [showLegacyImport, setShowLegacyImport] = useState(false);", "const [viewMode, setViewMode] = useLocalStorage('letters_viewMode', 'table');\n    const [showLegacyImport, setShowLegacyImport] = useState(false);");

// Ensure Calendar icon is imported
if (!content.includes('Calendar,')) {
    content = content.replace('Trash2, Printer,', 'Trash2, Printer, Calendar, List, Grid,');
}

fs.writeFileSync(path, content);
console.log('Letters cards view inserted successfully!');
