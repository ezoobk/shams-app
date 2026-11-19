import React, { useState, useMemo } from 'react';
import {
  X,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  Layers,
  User,
  Info,
  ArrowRight
} from 'lucide-react';
import { formatCurrency, parseDateSafely } from '../../utils/formatters';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface TechnicianInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: any[];
  allInvoices: any[];
  onConfirm: (invoiceData: {
    technicianName: string;
    specialty: string;
    items: any[];
    notes?: string;
  }) => void;
}

const DEFAULT_SPECIALTIES = [
  'أعمال كهرباء',
  'أعمال سباكة',
  'أعمال حدادة وتصنيع',
  'أعمال نجارة وتشطيب',
  'أعمال دهان وديكور',
  'أعمال تكييف وتهوية'
];

export const TechnicianInvoiceModal: React.FC<TechnicianInvoiceModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  allInvoices,
  onConfirm
}) => {
  const [specialties, setSpecialties] = useLocalStorage<string[]>(
    'shams_technician_specialties',
    DEFAULT_SPECIALTIES
  );

  const [technicianName, setTechnicianName] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(specialties[0] || 'أعمال كهرباء');
  const [showAddSpecialty, setShowAddSpecialty] = useState(false);
  const [newSpecialtyInput, setNewSpecialtyInput] = useState('');
  const [defaultPrice, setDefaultPrice] = useState<number | ''>('');
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({});
  const [excludedSNs, setExcludedSNs] = useState<Set<string>>(new Set());
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // Extract all existing productivity invoice items
  const productivityHistory = useMemo(() => {
    const map = new Map<string, Array<{
      invoiceId: string;
      date: string;
      technicianName: string;
      specialty: string;
      price: number;
    }>>();

    (allInvoices || [])
      .filter(inv => inv.type === 'إنتاجية' && Array.isArray(inv.items))
      .forEach(inv => {
        inv.items.forEach((item: any) => {
          if (item.serialNumber) {
            const list = map.get(item.serialNumber) || [];
            list.push({
              invoiceId: inv.id,
              date: inv.date,
              technicianName: item.technicianName || inv.customerName || 'غير محدد',
              specialty: item.specialty || 'إنتاجية',
              price: Number(item.sellPrice || 0)
            });
            map.set(item.serialNumber, list);
          }
        });
      });

    return map;
  }, [allInvoices]);

  // Active items (not excluded)
  const activeItems = useMemo(() => {
    return selectedItems.filter(item => !excludedSNs.has(item.serialNumber));
  }, [selectedItems, excludedSNs]);

  // Check conflicts for each item based on current technician and specialty
  const itemConflictStatus = useMemo(() => {
    const statusMap = new Map<string, {
      hasExactConflict: boolean;
      exactConflictDetails?: { invoiceId: string; technicianName: string; date: string; specialty: string };
      otherSpecialties: string[];
      historyCount: number;
    }>();

    selectedItems.forEach(item => {
      const history = productivityHistory.get(item.serialNumber) || [];
      const exactMatch = history.find(h => 
        h.specialty.trim().toLowerCase() === selectedSpecialty.trim().toLowerCase()
      );

      const otherSpecs = Array.from(new Set(
        history.filter(h => h.specialty.trim().toLowerCase() !== selectedSpecialty.trim().toLowerCase())
          .map(h => `${h.specialty} (${h.technicianName})`)
      ));

      statusMap.set(item.serialNumber, {
        hasExactConflict: !!exactMatch,
        exactConflictDetails: exactMatch,
        otherSpecialties: otherSpecs,
        historyCount: history.length
      });
    });

    return statusMap;
  }, [selectedItems, productivityHistory, selectedSpecialty]);

  const hasAnyExactConflictInActive = useMemo(() => {
    return activeItems.some(item => {
      const st = itemConflictStatus.get(item.serialNumber);
      return st?.hasExactConflict;
    });
  }, [activeItems, itemConflictStatus]);

  if (!isOpen) return null;

  const handleApplyDefaultPriceToAll = () => {
    if (defaultPrice === '' || isNaN(Number(defaultPrice))) return;
    const num = Number(defaultPrice);
    const updated: Record<string, number> = {};
    selectedItems.forEach(item => {
      updated[item.serialNumber] = num;
    });
    setItemPrices(updated);
  };

  const handlePriceChange = (serialNumber: string, val: string) => {
    const num = val === '' ? 0 : Number(val);
    setItemPrices(prev => ({ ...prev, [serialNumber]: num }));
  };

  const toggleExcludeSN = (serialNumber: string) => {
    setExcludedSNs(prev => {
      const next = new Set(prev);
      if (next.has(serialNumber)) next.delete(serialNumber);
      else next.add(serialNumber);
      return next;
    });
  };

  const handleAddNewSpecialty = () => {
    const clean = newSpecialtyInput.trim();
    if (!clean) return;
    if (!specialties.includes(clean)) {
      const updated = [...specialties, clean];
      setSpecialties(updated);
      setSelectedSpecialty(clean);
    } else {
      setSelectedSpecialty(clean);
    }
    setNewSpecialtyInput('');
    setShowAddSpecialty(false);
  };

  const calculateTotal = () => {
    return activeItems.reduce((sum, item) => {
      const price = itemPrices[item.serialNumber] ?? (defaultPrice !== '' ? Number(defaultPrice) : 0);
      return sum + price;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!technicianName.trim()) {
      alert('الرجاء إدخال اسم الفني / المستفيد.');
      return;
    }

    if (activeItems.length === 0) {
      alert('الرجاء تحديد منتج واحد على الأقل لإصدار الفاتورة.');
      return;
    }

    if (hasAnyExactConflictInActive) {
      const confirmForce = window.confirm(
        'تنبيه: هناك منتجات تم إصدار فاتورة إنتاجية سابقة لها في نفس هذا المجال بالتحديد!\nهل أنت متأكد من المتابعة والاستمرار؟'
      );
      if (!confirmForce) return;
    }

    const itemsForInvoice = activeItems.map(item => {
      const unitPrice = itemPrices[item.serialNumber] ?? (defaultPrice !== '' ? Number(defaultPrice) : 0);
      return {
        desc: item.desc || 'منتج تصنيع',
        chassis: item.chassis || '',
        length: item.length || '',
        width: item.width || '',
        height: item.height || '',
        serialNumber: item.serialNumber,
        mfgStatus: item.mfgStatus || item.status || 'جاهز',
        specialty: selectedSpecialty,
        technicianName: technicianName.trim(),
        unit: 'بند',
        requestedQty: 1,
        sellPrice: unitPrice,
        notes: `إنتاجية (${selectedSpecialty}) - رقم التصنيع: ${item.serialNumber}`,
        materials: item.materials || []
      };
    });

    onConfirm({
      technicianName: technicianName.trim(),
      specialty: selectedSpecialty,
      items: itemsForInvoice,
      notes: invoiceNotes.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-amber-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-700 shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                إصدار فاتورة إنتاجية للفنيين
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                  {selectedItems.length} منتج محدد
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تصدير المنتجات المختارة إلى محرر الفواتير بأرقام تصنيعهم وحالتهم وتسعيرة الإنتاجية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Technician & Specialty Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Technician Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                اسم الفني / المستفيد <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                placeholder="مثال: فني الكهرباء أحمد سالم..."
                className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-bold text-slate-800"
              />
            </div>

            {/* Specialty / Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  المجال / التخصص <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddSpecialty(!showAddSpecialty)}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  إضافة مجال جديد
                </button>
              </div>

              {showAddSpecialty ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSpecialtyInput}
                    onChange={e => setNewSpecialtyInput(e.target.value)}
                    placeholder="اكتب التخصص الجديد..."
                    className="flex-1 text-xs p-2 bg-white border border-amber-300 rounded-lg outline-none focus:border-amber-500 font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewSpecialty}
                    className="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
                  >
                    إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSpecialty(false)}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <select
                  value={selectedSpecialty}
                  onChange={e => setSelectedSpecialty(e.target.value)}
                  className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 font-bold text-slate-800 cursor-pointer"
                >
                  {specialties.map(spec => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Quick Price Setter */}
            <div className="sm:col-span-2 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  تسعيرة الوحدة الافتراضية (د.ل):
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={defaultPrice}
                  onChange={e => setDefaultPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-28 text-sm p-1.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 text-center font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleApplyDefaultPriceToAll}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                >
                  تطبيق السعر على جميع المنتجات
                </button>
              </div>

              <div className="text-xs text-slate-500">
                يمكنك أيضاً تعديل سعر كل منتج على حدة في الجدول أدناه
              </div>
            </div>
          </div>

          {/* Conflict Alert Banner if any duplicate exists */}
          {hasAnyExactConflictInActive && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm mb-0.5">تنبيه تعارض في الفوترة!</div>
                <div>
                  بعض المنتجات المحددة صُرفت لها فاتورة سابقة لنفس التخصص (<strong>{selectedSpecialty}</strong>).
                  يُنصح باستبعادها لتجنب ازدواجية الصرف، أو تغيير التخصص/المجال.
                </div>
              </div>
            </div>
          )}

          {/* Products List & Verification */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                المنتجات المحددة للفاتورة ({activeItems.length} من {selectedItems.length})
              </h3>
              <div className="text-xs text-slate-500">
                اضغط على زر الاستبعاد لاستثناء أي منتج من هذه الفاتورة
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3 text-center w-10">#</th>
                    <th className="p-3 w-40">رقم التصنيع S/N</th>
                    <th className="p-3">البيان والمواصفات</th>
                    <th className="p-3 text-center w-28">حالة التصنيع</th>
                    <th className="p-3 text-center w-32">تسعيرة الإنتاجية (د.ل)</th>
                    <th className="p-3 w-64">سجل الفواتير السابقة</th>
                    <th className="p-3 text-center w-12">استبعاد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedItems.map((item, idx) => {
                    const isExcluded = excludedSNs.has(item.serialNumber);
                    const conflict = itemConflictStatus.get(item.serialNumber);
                    const price = itemPrices[item.serialNumber] ?? (defaultPrice !== '' ? Number(defaultPrice) : 0);

                    return (
                      <tr
                        key={item.serialNumber}
                        className={`transition-colors ${
                          isExcluded
                            ? 'bg-slate-100/60 opacity-50'
                            : conflict?.hasExactConflict
                            ? 'bg-red-50/50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-3 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>

                        <td className="p-3 font-mono font-black text-slate-800">
                          <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-xs inline-block">
                            {item.serialNumber}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-800 text-xs">
                            {item.desc}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.chassis && <span>شاصية: {item.chassis} • </span>}
                            {(item.length || item.width || item.height) && (
                              <span>الأبعاد: {item.length}×{item.width}×{item.height}م</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            item.mfgStatus === 'جاهز' || item.status === 'جاهز'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {item.mfgStatus || item.status || 'جاهز'}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isExcluded}
                            value={price}
                            onChange={e => handlePriceChange(item.serialNumber, e.target.value)}
                            className="w-24 text-center p-1.5 border border-slate-300 rounded font-mono font-bold text-slate-800 outline-none focus:border-amber-500 disabled:bg-slate-100"
                          />
                        </td>

                        <td className="p-3">
                          {conflict?.hasExactConflict ? (
                            <div className="bg-red-100 text-red-800 border border-red-200 p-1.5 rounded text-[11px] font-bold">
                              <div>❌ تكرار لمجال ({selectedSpecialty})</div>
                              <div className="font-normal text-[10px] mt-0.5">
                                فاتورة: {conflict.exactConflictDetails?.invoiceId} للفني ({conflict.exactConflictDetails?.technicianName})
                              </div>
                            </div>
                          ) : conflict && conflict.otherSpecialties.length > 0 ? (
                            <div className="bg-blue-50 text-blue-700 border border-blue-200 p-1.5 rounded text-[11px]">
                              <span className="font-bold">✓ سبق صرف:</span>{' '}
                              {conflict.otherSpecialties.join('، ')}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              لا توجد فواتير إنتاجية سابقة
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExcludeSN(item.serialNumber)}
                            className={`p-1.5 rounded transition-colors ${
                              isExcluded
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={isExcluded ? 'إعادة التضمين' : 'استبعاد من الفاتورة'}
                          >
                            {isExcluded ? <Plus className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات الفاتورة (اختياري)
            </label>
            <textarea
              rows={2}
              value={invoiceNotes}
              onChange={e => setInvoiceNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية على أمر العمل أو مستحقات الفني..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:border-amber-500"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-500 block">إجمالي المنتجات المفوترة:</span>
              <span className="font-bold text-slate-800 text-base">{activeItems.length} بند</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-xs text-slate-500 block">إجمالي المستحقات:</span>
              <span className="font-black text-amber-700 text-lg dir-ltr">
                {formatCurrency(calculateTotal())} د.ل
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all"
            >
              <span>تأكيد والتحويل لمحرر الفواتير</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
