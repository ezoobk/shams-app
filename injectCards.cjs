const fs = require('fs');

const path = 'src/views/WorkOrders/WorkOrdersView.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStart = `<div className="overflow-x-auto w-full">
            <table className="w-full text-right text-sm">`;
const targetEnd = `              </tbody>
            </table>
          </div>
          {sortedFlattenedItems.length > 0 && (`;

const split1 = content.split(targetStart);
const split2 = split1[1].split(targetEnd);

const tableContent = targetStart + split2[0] + `              </tbody>
            </table>
          </div>`;

const newJSX = `{viewMode === 'table' ? (
          ${tableContent}
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {paginatedItems.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد أوامر عمل تطابق البحث.</div>
            ) : (
              paginatedItems.map((item, idx) => (
                <div key={item.serialNumber} className={\`relative flex flex-col bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md \${selectedItemsForInvoice.includes(item.serialNumber) ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-200'}\`}>
                  <div className="absolute top-4 left-4">
                    <input type="checkbox" className="w-5 h-5 cursor-pointer accent-indigo-600" disabled={(item._saleStatus === 'مباع' && (item._mfgStatus !== 'جاهز' || item._shippingStatus === 'منقولة')) || item._shippingStatus === 'منقولة'} checked={selectedItemsForInvoice.includes(item.serialNumber)} onChange={() => handleSelectForInvoice(item.serialNumber)} />
                  </div>
                  
                  <div className="mb-3 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{item._woId}</span>
                      {item._woDate && <span className="text-xs text-slate-500 font-mono">{new Date(item._woDate).toLocaleDateString('en-GB')}</span>}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight mt-2 pl-6">{item.desc}</h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={\`text-xs font-bold px-2 py-1 rounded-full border \${item._mfgStatus === 'جاهز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}\`}>{item._mfgStatus}</span>
                    <span className={\`text-xs font-bold px-2 py-1 rounded-full border \${item._saleStatus === 'مباع' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}\`}>{item._saleStatus}</span>
                    <span className={\`text-xs font-bold px-2 py-1 rounded-full border \${item._shippingStatus === 'منقولة' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}\`}>{item._shippingStatus}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mb-4 flex-1">
                    <div><span className="text-slate-400 block text-xs">رقم التصنيع (SN)</span><span className="font-mono font-bold text-slate-700">{item.serialNumber}</span></div>
                    <div><span className="text-slate-400 block text-xs">السعر</span><span className="font-bold text-emerald-600" dir="ltr">{formatCurrency(item.sellPrice)}</span></div>
                    <div className="col-span-2"><span className="text-slate-400 block text-xs">الشاصية / الأبعاد</span>{item.chassis} | {item.length}x{item.width}x{item.height}</div>
                    {item.notes && <div className="col-span-2"><span className="text-slate-400 block text-xs">ملاحظات</span>{item.notes}</div>}
                    
                    {/* Extra details logic from table */}
                    {item._inv && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-xs">معلومات الفاتورة</span>
                        <div className="text-xs font-bold">INV: {item._inv.id} - {item._inv.customerName}</div>
                      </div>
                    )}
                    {item._so && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-xs">معلومات النقل</span>
                        <div className="text-xs font-bold">SO: {item._so.id} - {item._so.driverName}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="flex gap-1">
                      <button onClick={() => setPrintData({ type: 'WORK_ORDER', data: item._wo })} className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200 transition-colors" title="طباعة للتصنيع"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => { if (window.confirm('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟')) setWorkOrders(workOrders.filter(w => w.id !== item._woId)); }} className="bg-red-50 text-red-500 p-2 rounded hover:bg-red-100 transition-colors" title="إلغاء الأمر"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(item._woId, item.serialNumber)} className="text-xs px-2 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 transition-colors font-medium">الحالة</button>
                      <button onClick={() => { setEditingEstimate(item); setEditingContext({ type: 'workOrder', woId: item._woId }); setViewState('calculator'); window.scrollTo(0,0); }} className="text-xs px-2 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors">المواد</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
          {sortedFlattenedItems.length > 0 && (`;

content = split1[0] + newJSX + split2[1];

fs.writeFileSync(path, content);
console.log('Cards view inserted successfully!');
