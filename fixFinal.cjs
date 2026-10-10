const fs = require('fs');

let content = fs.readFileSync('src/views/Invoices/OutboundLogView.tsx', 'utf8');

const startMarker = "{activeSubTab === 'general' && (";
const endMarker = "        {activeSubTab === 'letters' && (";

const idxStart = content.indexOf(startMarker);
const idxEnd = content.indexOf(endMarker);

if (idxStart === -1 || idxEnd === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const replacement = `{activeSubTab === 'general' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>العميل / الجهة {getSortIcon('customerName')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('subject')}>الموضوع {getSortIcon('subject')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGeneral.map((record, idx) => (
                      <tr key={\`general-\${record.id}-\${idx}\`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-800">{record.id}</td>
                        <td className="p-4 text-center whitespace-nowrap">{new Date(record.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 font-bold">{record.customerName}</td>
                        <td className="p-4">
                          <span className={\`px-3 py-1 rounded-full text-xs font-bold \${
                             record.sourceType === 'invoice' ? 'bg-indigo-100 text-indigo-700' :
                             record.sourceType === 'shipping' ? 'bg-emerald-100 text-emerald-700' :
                             'bg-blue-100 text-blue-700'
                          }\`}>{record.subject}</span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
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
                            }} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedGeneral.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد سجلات مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedGeneral.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات.</div>
                ) : (
                  paginatedGeneral.map((record, idx) => (
                    <div key={\`general-card-\${record.id}-\${idx}\`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
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
                  ))
                )}
              </div>
            )}
            
            {filteredGeneral.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('general')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredGeneral.length)} من {filteredGeneral.length} سجل
                  </span>
                </div>
                {totalGeneralPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalGeneralPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalGeneralPages, p + 1))} 
                      disabled={currentPage === totalGeneralPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'invoices' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('type')}>النوع {getSortIcon('type')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>الزبون {getSortIcon('customerName')}</th>
                      <th className="p-4 text-center w-32 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('netTotal')}>المبلغ {getSortIcon('netTotal')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((inv, idx) => (
                      <tr key={\`inv-\${inv.id}-\${idx}\`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">{inv.id}</td>
                        <td className="p-4 text-center"><span className={\`px-3 py-1 rounded-full text-xs font-bold \${inv.type === 'نهائية' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}\`}>{inv.type}</span></td>
                        <td className="p-4 font-semibold text-slate-800">{inv.customerName}</td>
                        <td className="p-4 text-center text-slate-500 whitespace-nowrap">{new Date(inv.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 text-center font-bold text-blue-600 dir-ltr">{formatCurrency(inv.netTotal)}</td>
                        <td className="p-4 text-center">
                          {filterType === 'محذوفة' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">حُذفت في: {inv.deletedAt ? new Date(inv.deletedAt).toLocaleDateString('ar-LY') : 'غير معروف'}</span>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>
                              <button onClick={() => { setEditingInvoice(inv); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1">تعديل / عرض التفاصيل</button>
                              <button onClick={() => deleteInvoice(inv)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginatedInvoices.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد فواتير مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedInvoices.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد فواتير مطابقة.</div>
                ) : (
                  paginatedInvoices.map(inv => {
                    const isDeleted = filterType === 'محذوفة';
                    return (
                      <div key={\`inv-card-\${inv.id}\`} className={\`bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md flex flex-col \${isDeleted ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}\`}>
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
              </div>
            )}
            
            {filteredInvoices.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('invoices')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredInvoices.length)} من {filteredInvoices.length} فاتورة
                  </span>
                </div>
                {totalInvoicesPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalInvoicesPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalInvoicesPages, p + 1))} 
                      disabled={currentPage === totalInvoicesPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'shipping' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>رقم أمر النقل {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('driverName')}>السائق / الناقل {getSortIcon('driverName')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('destination')}>الوجهة {getSortIcon('destination')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('price')}>سعر النقل {getSortIcon('price')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedShipping.map((so, idx) => (
                      <tr key={\`so-\${so.id}-\${idx}\`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">{so.id}</td>
                        <td className="p-4 text-center text-slate-500 whitespace-nowrap">{new Date(so.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 font-semibold text-slate-800">{so.driverName}</td>
                        <td className="p-4 text-slate-600">{so.destination}</td>
                        <td className="p-4 text-center font-bold text-emerald-600 dir-ltr">{formatCurrency(so.price)}</td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: so })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>
                            <button onClick={() => deleteShippingOrder(so)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedShipping.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد سجلات نقل مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedShipping.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات نقل.</div>
                ) : (
                  paginatedShipping.map(so => (
                    <div key={\`so-card-\${so.id}\`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
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
              </div>
            )}
            
            {filteredShipping.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('shipping')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredShipping.length)} من {filteredShipping.length} أمر نقل
                  </span>
                </div>
                {totalShippingPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalShippingPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalShippingPages, p + 1))} 
                      disabled={currentPage === totalShippingPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

`;

content = content.substring(0, idxStart) + replacement + content.substring(idxEnd);

fs.writeFileSync('src/views/Invoices/OutboundLogView.tsx', content);
console.log('done');
