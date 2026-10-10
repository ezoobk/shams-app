const fs = require('fs');
const path = 'src/views/WorkOrders/WorkOrdersView.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStart = `<div className="overflow-x-auto">
            <table className="w-full text-right text-sm">`;
            
const targetEnd = `              </tbody>
            </table>
          </div>`;

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd) + targetEnd.length;

if (startIndex === -1 || endIndex < startIndex) {
    console.error("Could not find table block");
    process.exit(1);
}

const tableContent = content.substring(startIndex, endIndex);

const newJSX = `{viewMode === 'table' ? (
          ${tableContent}
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {paginatedItems.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد أوامر عمل تطابق البحث.</div>
            ) : (
              paginatedItems.map((item, idx) => (
                <div key={item.serialNumber} className={\`relative flex flex-col bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md \${selectedItemsForInvoice.includes(item.serialNumber) ? 'border-indigo-400 ring-2 ring-indigo-400 bg-indigo-50/30' : 'border-slate-200'}\`}>
                  <div className="absolute top-4 left-4 z-10 bg-white rounded-full">
                    <input type="checkbox" className="w-5 h-5 cursor-pointer accent-indigo-600" disabled={(item._saleStatus === 'مباع' && (item._mfgStatus !== 'جاهز' || item._shippingStatus === 'منقولة')) || item._shippingStatus === 'منقولة'} checked={selectedItemsForInvoice.includes(item.serialNumber)} onChange={() => handleSelectForInvoice(item.serialNumber)} />
                  </div>
                  
                  <div className="mb-3 pr-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{item._woId}</span>
                      {item._woDate && <span className="text-xs text-slate-500 font-mono">{new Date(item._woDate).toLocaleDateString('en-GB')}</span>}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight pl-6">{item.desc}</h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={\`text-xs font-bold px-2 py-1 rounded-full border \${item._mfgStatus === 'جاهز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}\`}>{item._mfgStatus}</span>
                    <span className={\`text-xs font-bold px-2 py-1 rounded-full border \${item._saleStatus === 'مباع' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}\`}>{item._saleStatus}</span>
                    <span className={\`text-xs font-bold px-2 py-1 rounded-full border \${item._shippingStatus === 'منقولة' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}\`}>{item._shippingStatus}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mb-4 flex-1">
                    <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">رقم التصنيع (SN)</span><span className="font-mono font-bold text-slate-700 text-sm">{item.serialNumber}</span></div>
                    <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">السعر</span><span className="font-black text-emerald-600 text-sm" dir="ltr">{formatCurrency(item.sellPrice)}</span></div>
                    <div className="col-span-2"><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">الشاصية / الأبعاد</span><span className="font-medium text-slate-700 text-sm">{item.chassis} | {item.length}x{item.width}x{item.height}</span></div>
                    {item.notes && <div className="col-span-2"><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">ملاحظات</span><span className="text-slate-700 text-sm">{item.notes}</span></div>}
                    
                    {item._inv && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">معلومات الفاتورة</span>
                        <div className="text-xs font-bold text-blue-700">INV: {item._inv.id} - {item._inv.customerName}</div>
                      </div>
                    )}
                    {item._so && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">معلومات النقل</span>
                        <div className="text-xs font-bold text-purple-700">SO: {item._so.id} - {item._so.driverName}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="flex gap-1">
                      <button onClick={() => setPrintData({ type: 'WORK_ORDER', data: item._wo })} className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200 transition-colors" title="طباعة للتصنيع"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => { if (window.confirm('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟')) setWorkOrders(workOrders.filter(w => w.id !== item._woId)); }} className="bg-red-50 text-red-500 p-2 rounded hover:bg-red-100 transition-colors" title="إلغاء الأمر"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(item._woId, item.serialNumber)} className="text-xs px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 transition-colors font-bold">الحالة</button>
                      <button onClick={() => { setEditingEstimate(item); setEditingContext({ type: 'workOrder', woId: item._woId }); setViewState('calculator'); window.scrollTo(0,0); }} className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-colors shadow-sm">المواد</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}`;

content = content.substring(0, startIndex) + newJSX + content.substring(endIndex);

fs.writeFileSync(path, content);
console.log('Cards view inserted successfully!');
