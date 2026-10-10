const fs = require('fs');
const path = 'src/views/Invoices/OutboundLogView.tsx';
let content = fs.readFileSync(path, 'utf8');

function injectView(tabName, startMarker, endMarker, mapVarName, isDeletedLogic, printInvoiceType, printShippingType, renderCardFunc) {
    const s1 = content.indexOf(startMarker);
    if (s1 === -1) {
        console.error("Could not find start for tab:", tabName);
        return;
    }
    const endStr = endMarker;
    const s2 = content.indexOf(endStr, s1);
    if (s2 === -1) {
        console.error("Could not find end for tab:", tabName);
        return;
    }

    const tableCode = content.substring(s1, s2 + endStr.length);
    if (tableCode.includes('viewMode === \'table\'')) {
        console.log("Already injected for", tabName);
        return;
    }

    const cardsCode = `          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {${mapVarName}.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات.</div>
            ) : (
              ${mapVarName}.map((record, idx) => {
                ${isDeletedLogic}
                return (${renderCardFunc})
              })
            )}
          </div>`;

    const newCode = `{viewMode === 'table' ? (\n${tableCode}\n) : (\n${cardsCode}\n)}`;
    
    content = content.substring(0, s1) + newCode + content.substring(s2 + endStr.length);
    console.log("Successfully injected", tabName);
}

// 1. General
injectView('general', 
    '<div className="overflow-x-auto w-full">',
    '</table>\n</div>',
    'paginatedGeneral',
    '',
    '', '',
    `
    <div key={\`\${record.id}-\${idx}\`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                  <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{record.id}</span>
                      <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(record.date).toLocaleDateString('ar-LY')}</div>
                    </div>
                    <span className={\`px-3 py-1 rounded-full text-xs font-bold \${
                       record.sourceType === 'invoice' ? 'bg-indigo-100 text-indigo-700' :
                       record.sourceType === 'shipping' ? 'bg-emerald-100 text-emerald-700' :
                       'bg-blue-100 text-blue-700'
                    }\`}>{record.subject}</span>
                  </div>
                  <div className="flex-1 mb-4">
                    <div className="text-xs uppercase font-bold text-slate-400 mb-1">العميل / الجهة</div>
                    <div className="font-black text-slate-800">{record.customerName}</div>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => {
                       if (record.sourceType === 'invoice') setPrintData({ type: 'INVOICE', data: record.original });
                       if (record.sourceType === 'shipping') setPrintData({ type: 'SHIPPING_ORDER', data: record.original });
                       if (record.sourceType === 'letter') setPrintData({ type: 'LETTER', data: record.original });
                    }} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>
                    <button onClick={() => {
                       if (record.sourceType === 'invoice') deleteInvoice(record.original);
                       if (record.sourceType === 'shipping') deleteShippingOrder(record.original);
                       if (record.sourceType === 'letter') {
                         if (window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
                           setLetters(letters.filter(l => l.id !== record.original.id));
                         }
                       }
                    }} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded font-bold text-xs"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
    `
);

// We need to re-find for 'invoices' and 'shipping' using offsets because there are multiple '<div className="overflow-x-auto w-full">'
// So let's write a targeted replace for invoices.
let invOffset = content.indexOf("activeSubTab === 'invoices'");
if (invOffset !== -1) {
    let s1 = content.indexOf('<div className="overflow-x-auto w-full">', invOffset);
    let s2 = content.indexOf('</table>\n</div>', s1);
    if (s1 !== -1 && s2 !== -1) {
        let tableCode = content.substring(s1, s2 + '</table>\n</div>'.length);
        if (!tableCode.includes("viewMode === 'table'")) {
            let cardsCode = `          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {paginatedInvoices.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد فواتير مطابقة.</div>
            ) : (
              paginatedInvoices.map(inv => {
                const isDeleted = filterType === 'محذوفة';
                return (
                  <div key={inv.id} className={\`bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md flex flex-col \${isDeleted ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}\`}>
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{inv.id}</span>
                        <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(inv.date).toLocaleDateString('ar-LY')}</div>
                      </div>
                      <span className={\`px-3 py-1 rounded-full text-xs font-bold \${inv.type === 'نهائية' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}\`}>{inv.type}</span>
                    </div>
                    <div className="flex-1 mb-4">
                      <div className="text-xs uppercase font-bold text-slate-400 mb-1">العميل</div>
                      <div className="font-black text-slate-800 text-base">{inv.customerName}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg mb-4 text-center">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">الإجمالي</div>
                        <div className="font-bold text-emerald-600 text-sm" dir="ltr">{formatCurrency(inv.netTotal)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">المتبقي</div>
                        <div className="font-bold text-red-600 text-sm" dir="ltr">{formatCurrency(inv.remainingAmount)}</div>
                      </div>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex gap-1">
                        <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>
                        {!isDeleted && <button onClick={() => deleteInvoice(inv)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded" title="إلغاء الفاتورة"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      {!isDeleted && (
                        <button onClick={() => { setEditingInvoice(inv); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1">
                          تعديل / عرض التفاصيل
                        </button>
                      )}
                      {isDeleted && inv.deletedAt && (
                        <div className="text-xs text-red-500 font-bold self-center">حُذفت في: {new Date(inv.deletedAt).toLocaleDateString('ar-LY')}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>`;
            content = content.substring(0, s1) + `{viewMode === 'table' ? (\n${tableCode}\n) : (\n${cardsCode}\n)}` + content.substring(s2 + '</table>\n</div>'.length);
            console.log("Successfully injected invoices");
        }
    }
}

// 3. Shipping
let shipOffset = content.indexOf("activeSubTab === 'shipping'");
if (shipOffset !== -1) {
    let s1 = content.indexOf('<div className="overflow-x-auto w-full">', shipOffset);
    let s2 = content.indexOf('</table>\n</div>', s1);
    if (s1 !== -1 && s2 !== -1) {
        let tableCode = content.substring(s1, s2 + '</table>\n</div>'.length);
        if (!tableCode.includes("viewMode === 'table'")) {
            let cardsCode = `          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {paginatedShipping.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات نقل.</div>
            ) : (
              paginatedShipping.map(so => (
                <div key={so.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                  <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2">{so.id}</span>
                      <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(so.date).toLocaleDateString('ar-LY')}</div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">أمر نقل</span>
                  </div>
                  <div className="flex-1 mb-4">
                    <div className="text-xs uppercase font-bold text-slate-400 mb-1">الناقل / السائق</div>
                    <div className="font-black text-slate-800 text-base mb-3">{so.driverName}</div>
                    <div className="text-xs uppercase font-bold text-slate-400 mb-1">الوجهة</div>
                    <div className="font-bold text-slate-700 text-sm">{so.destination}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg mb-4 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">سعر النقل</div>
                    <div className="font-bold text-emerald-600 text-sm" dir="ltr">{formatCurrency(so.price)}</div>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: so })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>
                    <button onClick={() => deleteShippingOrder(so)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded font-bold text-xs"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )}
          </div>`;
            content = content.substring(0, s1) + `{viewMode === 'table' ? (\n${tableCode}\n) : (\n${cardsCode}\n)}` + content.substring(s2 + '</table>\n</div>'.length);
            console.log("Successfully injected shipping");
        }
    }
}

fs.writeFileSync(path, content);
console.log('OutboundLog cards applied completely!');
