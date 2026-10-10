import React, { useState, useEffect } from 'react';
import { useInvoices } from '../../context/InvoicesContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useCustomers } from '../../context/CustomersContext';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { FileText, Save, X, Trash2, Plus, Printer, Check, FileEdit, Copy } from 'lucide-react';
import { useDatabaseObject } from '../../hooks/useDatabaseObject';

const SmartTextField = ({ label, value, onChange, placeholder, savedItems, setSavedItems }) => (
  <div className="flex-1 bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <label className="font-bold text-slate-700">{label}</label>
      {savedItems && savedItems.length > 0 && (
        <select className="text-xs border border-slate-200 rounded p-1 bg-slate-50 text-slate-600 outline-none w-32" onChange={e => { if (e.target.value) onChange(e.target.value); e.target.value = ''; }}>
          <option value="">اختيار محفوظ...</option>
          {savedItems.map((item, i) => <option key={i} value={item}>{item.substring(0, 20)}...</option>)}
        </select>
      )}
    </div>
    <textarea className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 h-24 resize-none" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    <div className="flex justify-end mt-2">
      <button onClick={() => { if (value && !savedItems.includes(value)) setSavedItems([...savedItems, value]); }} className="text-xs text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1"><Save className="w-3 h-3" /> حفظ كنموذج</button>
    </div>
  </div>
);

export const InvoiceEditorView = ({ editingInvoice, setEditingInvoice, setViewState }: any) => {
    const [savedNotes, setSavedNotes] = useDatabaseObject('shams_savedNotes', []);
    const [savedTerms, setSavedTerms] = useDatabaseObject('shams_savedTerms', []);
    const { invoices, setInvoices } = useInvoices();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { estimates } = useEstimates();
    const { generateId, appSettings } = useSettings();
    const { setPrintData } = usePrint();
    const { customers } = useCustomers();
    const [inv, setInv] = useState(() => JSON.parse(JSON.stringify(editingInvoice)));
    const [selectedItemToAdd, setSelectedItemToAdd] = useState('');

    useEffect(() => {
      const subtotal = inv.items.reduce((sum, item) => sum + (Number(item.sellPrice) * Number(item.requestedQty || 1)), 0);
      const net = subtotal - Number(inv.discount || 0);
      setInv(prev => ({ ...prev, total: subtotal, netTotal: net }));
    }, [inv.items, inv.discount]);

    const handleItemChange = (index, field, value) => {
      const newItems = [...inv.items];
      newItems[index] = { ...newItems[index], [field]: field === 'desc' ? value : Number(value) };
      setInv({ ...inv, items: newItems });
    };

    const handleRemoveItem = (index) => {
      const newItems = [...inv.items];
      newItems.splice(index, 1);
      setInv({ ...inv, items: newItems });
    };

    const handleAddCustomItem = () => {
      setInv({
        ...inv,
        items: [
          ...inv.items,
          { isCustom: true, desc: '', requestedQty: 1, sellPrice: 0 }
        ]
      });
    };

    const handleAddItem = (e) => {
      const val = e.target.value;
      if (!val) return;
      let newItem = null;
      if (inv.type === 'مبدئية') {
        const est = estimates.find(est => est.id.toString() === val);
        if (est) newItem = { ...JSON.parse(JSON.stringify(est)), requestedQty: 1 };
      } else {
        const woItems = workOrders.flatMap(wo => wo.items).filter(i => i.status === 'جاهز');
        const woItem = woItems.find(i => i.serialNumber === val);
        if (woItem) newItem = { ...JSON.parse(JSON.stringify(woItem)), requestedQty: 1 };
      }
      if (newItem) setInv({ ...inv, items: [...inv.items, newItem] });
      setSelectedItemToAdd('');
    };

    const saveChanges = (asNewBranch) => {
      if (inv.items.length === 0) return alert('لا يمكن حفظ فاتورة فارغة.');
      if (!inv.customerName) return alert('يجب تحديد اسم الزبون.');

      const finalInvoiceData = { ...inv };

      if (asNewBranch || inv.isDraft) {
        if (inv.isDraft) delete finalInvoiceData.isDraft;
        finalInvoiceData.id = inv.id || generateId(inv.type === 'مبدئية' ? 'invP' : 'invF', inv.customerName);
        finalInvoiceData.date = new Date().toISOString();
        setInvoices([finalInvoiceData, ...invoices]);
      } else {
        setInvoices(invoices.map(i => i.id === inv.id ? finalInvoiceData : i));
      }

      if (inv.type === 'نهائية') {
        const originalSNs = (editingInvoice.isDraft ? [] : editingInvoice.items).map(i => i.serialNumber).filter(Boolean);
        const currentSNs = finalInvoiceData.items.map(i => i.serialNumber).filter(Boolean);
        const toReady = originalSNs.filter(sn => !currentSNs.includes(sn));
        const toSold = currentSNs.filter(sn => !originalSNs.includes(sn));

        if (toReady.length > 0 || toSold.length > 0) {
          setWorkOrders(prev => prev.map(wo => {
            let changed = false;
            const newWoItems = wo.items.map(wi => {
              if (toReady.includes(wi.serialNumber)) { changed = true; return { ...wi, status: wi.mfgStatus || (wi.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع') }; }
              if (toSold.includes(wi.serialNumber)) { changed = true; return { ...wi, status: 'مباع', mfgStatus: wi.mfgStatus || (wi.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع') }; }
              return wi;
            });
            return changed ? { ...wo, items: newWoItems } : wo;
          }));
        }
      }

      if (window.electronAPI && appSettings.outboundLogPath) {
        setPrintData({ type: 'INVOICE', data: finalInvoiceData, silentExport: true });
      } else {
        setEditingInvoice(null);
      }
      setViewState('list');
    };

    const availableToAdd = inv.type === 'مبدئية'
      ? estimates
      : workOrders.flatMap(wo => wo.items).filter(i => i.status === 'جاهز' && !inv.items.some(invItem => invItem.serialNumber === i.serialNumber));

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileEdit className="w-6 h-6 text-blue-600" /> محرر الفواتير الذكي</h2>
            <div className="text-slate-500 text-sm mt-1">تعديل الفاتورة رقم: <span className="font-mono font-bold text-slate-700">{inv.id}</span> ({inv.type})</div>
          </div>
          <button onClick={() => { setEditingInvoice(null); setViewState('list'); }} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الزبون / العميل</label>
            <input type="text" className="w-full p-2.5 border border-slate-300 rounded outline-none focus:border-blue-500" value={inv.customerName} onChange={e => setInv({ ...inv, customerName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">قيمة التخفيض (د.ل)</label>
            <input type="number" min="0" className="w-full p-2.5 border border-slate-300 rounded outline-none focus:border-blue-500" value={inv.discount || ''} onChange={e => setInv({ ...inv, discount: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <SmartTextField
            label="ملاحظات الفاتورة"
            value={inv.notes}
            onChange={val => setInv({ ...inv, notes: val })}
            placeholder="أضف أي ملاحظات إضافية هنا..."
            savedItems={savedNotes}
            setSavedItems={setSavedNotes}
          />
          <SmartTextField
            label="الشروط والأحكام"
            value={inv.terms}
            onChange={val => setInv({ ...inv, terms: val })}
            placeholder="مثال: الضمان، شروط الدفع، الخ..."
            savedItems={savedTerms}
            setSavedItems={setSavedTerms}
          />
        </div>

        <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
          <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3 w-1/2">البيان والمواصفات</th>
                {inv.type === 'نهائية' && <th className="p-3 text-center">S/N</th>}
                <th className="p-3 text-center w-24">الكمية</th>
                <th className="p-3 text-center w-40">سعر الوحدة (قابل للتعديل)</th>
                <th className="p-3 text-center w-32">الإجمالي</th>
                <th className="p-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    {item.isCustom ? (
                      <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" placeholder="وصف البند (مثال: نقل ومناولة)" value={item.desc} onChange={e => handleItemChange(idx, 'desc', e.target.value)} />
                    ) : (
                      <>
                        <div className="font-bold text-slate-800">{item.desc}</div>
                        <div className="text-xs text-slate-500 mt-1">شاصية: {item.chassis} | أبعاد: {item.length}x{item.width}x{item.height}</div>
                      </>
                    )}
                  </td>
                  {inv.type === 'نهائية' && <td className="p-3 text-center font-mono text-blue-600 font-bold">{item.isCustom ? '-' : item.serialNumber}</td>}
                  <td className="p-3 text-center">
                    {(inv.type === 'مبدئية' || item.isCustom)
                      ? <input type="number" min="1" className="w-full p-2 border border-slate-300 rounded text-center outline-none focus:border-blue-500" value={item.requestedQty || 1} onChange={e => handleItemChange(idx, 'requestedQty', e.target.value)} />
                      : <span className="font-bold text-slate-700">{item.requestedQty || 1}</span>
                    }
                  </td>
                  <td className="p-3 text-center">
                    <input type="number" min="0" className="w-full p-2 border border-blue-300 bg-blue-50 rounded text-center outline-none focus:border-blue-500 font-bold" value={item.sellPrice} onChange={e => handleItemChange(idx, 'sellPrice', e.target.value)} />
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700 dir-ltr">{formatCurrency(item.sellPrice * (item.requestedQty || 1))}</td>
                  <td className="p-3 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 p-1 bg-white border rounded shadow-sm"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={inv.type === 'نهائية' ? 5 : 4} className="p-3">
                  <div className="flex gap-2">
                    <select className="flex-1 p-2 border border-slate-300 rounded outline-none" value={selectedItemToAdd} onChange={handleAddItem}>
                      <option value="">+ إضافة منتج للفاتورة...</option>
                      {availableToAdd.map(av => (
                        <option key={inv.type === 'مبدئية' ? av.id : av.serialNumber} value={inv.type === 'مبدئية' ? av.id : av.serialNumber}>
                          {av.desc} - {inv.type === 'نهائية' ? `S/N: ${av.serialNumber}` : formatCurrency(av.sellPrice)}
                        </option>
                      ))}
                    </select>
                    <button onClick={handleAddCustomItem} className="bg-slate-200 text-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-300 whitespace-nowrap">+ إضافة بند مخصص</button>
                  </div>
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
</div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl text-white shadow-md flex justify-between items-center gap-6">
          <div className="flex gap-8">
            <div><div className="text-slate-400 text-sm mb-1">المجموع الكلي</div><div className="text-xl font-bold text-slate-300 dir-ltr">{formatCurrency(inv.total)}</div></div>
            <div><div className="text-slate-400 text-sm mb-1">الصافي بعد التخفيض</div><div className="text-2xl font-bold text-green-400 dir-ltr">{formatCurrency(inv.netTotal)}</div></div>
          </div>
          <div className="flex gap-3">
            {inv.isDraft ? (
              <button onClick={() => saveChanges(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2"><Save className="w-5 h-5" /> حفظ الفاتورة</button>
            ) : (
              <>
                <button onClick={() => saveChanges(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2"><Save className="w-5 h-5" /> حفظ</button>
                {inv.type === 'مبدئية' && (
                  <button onClick={() => saveChanges(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2"><Copy className="w-5 h-5" /> حفظ كجديد</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };
