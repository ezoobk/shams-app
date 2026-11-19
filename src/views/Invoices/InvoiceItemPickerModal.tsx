import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Check,
  Package,
  FileText,
  Factory,
  Filter,
  CheckSquare,
  Square,
  Calendar,
  Layers,
  Clock
} from 'lucide-react';
import { formatCurrency, parseDateSafely } from '../../utils/formatters';

interface InvoiceItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'materials' | 'estimatesOrProducts';
  invoiceType: 'مبدئية' | 'نهائية';
  availableItems: any[];
  onAddSingle: (item: any) => void;
  onAddMultiple: (items: any[]) => void;
  estimateCategories?: { id: string; name: string }[];
}

export const InvoiceItemPickerModal: React.FC<InvoiceItemPickerModalProps> = ({
  isOpen,
  onClose,
  type,
  invoiceType,
  availableItems,
  onAddSingle,
  onAddMultiple,
  estimateCategories = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'lastUpdated' | 'dateDesc' | 'dateAsc'>('lastUpdated');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string | number>>(new Set());

  // Reset local state when modal opens or type changes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedUnit('all');
      setSelectedCategory('all');
      setSortBy('lastUpdated');
      setSelectedIds(new Set());
      setAddedIds(new Set());
    }
  }, [isOpen, type]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract unique units for materials filter
  const availableUnits = useMemo(() => {
    if (type !== 'materials') return [];
    const units = new Set<string>();
    availableItems.forEach(item => {
      if (item.unit && item.unit.trim()) {
        units.add(item.unit.trim());
      }
    });
    return Array.from(units);
  }, [availableItems, type]);

  // Helper to get item's unique key for selection
  const getItemKey = (item: any): string | number => {
    if (type === 'materials') return item.id;
    if (invoiceType === 'مبدئية') return item.id || `${item.desc}_${item.chassis}`;
    return item.serialNumber || item.id;
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = availableItems;

    // Filter by unit (for materials)
    if (type === 'materials' && selectedUnit !== 'all') {
      result = result.filter(item => (item.unit || '').trim() === selectedUnit);
    }

    // Filter by category (for estimates)
    if (type === 'estimatesOrProducts' && invoiceType === 'مبدئية' && selectedCategory !== 'all') {
      result = result.filter(item => item.categoryId === selectedCategory);
    }

    // Text search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(item => {
        if (type === 'materials') {
          return (
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.shortName && item.shortName.toLowerCase().includes(q)) ||
            (item.unit && item.unit.toLowerCase().includes(q)) ||
            String(item.defaultPrice || '').includes(q)
          );
        } else if (invoiceType === 'مبدئية') {
          return (
            (item.desc && item.desc.toLowerCase().includes(q)) ||
            (item.chassis && item.chassis.toLowerCase().includes(q)) ||
            String(item.length || '').includes(q) ||
            String(item.width || '').includes(q) ||
            String(item.height || '').includes(q) ||
            String(item.sellPrice || '').includes(q)
          );
        } else {
          // Final invoice: products from work orders
          return (
            (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
            (item.desc && item.desc.toLowerCase().includes(q)) ||
            (item.chassis && item.chassis.toLowerCase().includes(q)) ||
            (item.notes && item.notes.toLowerCase().includes(q)) ||
            (item.woId && item.woId.toLowerCase().includes(q))
          );
        }
      });
    }

    // Date sorting (Default: lastUpdated descending)
    result = [...result].sort((a, b) => {
      const getTimestamp = (item: any, mode: 'lastUpdated' | 'dateDesc' | 'dateAsc') => {
        if (mode === 'lastUpdated') {
          const val = item.lastUpdated || item.date || item.id;
          return parseDateSafely(val).getTime();
        } else {
          const val = item.date || item.id || item.lastUpdated;
          return parseDateSafely(val).getTime();
        }
      };

      if (sortBy === 'lastUpdated') {
        const timeA = getTimestamp(a, 'lastUpdated');
        const timeB = getTimestamp(b, 'lastUpdated');
        if (timeB !== timeA) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      } else if (sortBy === 'dateDesc') {
        const timeA = getTimestamp(a, 'dateDesc');
        const timeB = getTimestamp(b, 'dateDesc');
        if (timeB !== timeA) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      } else if (sortBy === 'dateAsc') {
        const timeA = getTimestamp(a, 'dateAsc');
        const timeB = getTimestamp(b, 'dateAsc');
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id || '').localeCompare(String(b.id || ''));
      }
      return 0;
    });

    return result;
  }, [availableItems, searchTerm, selectedUnit, selectedCategory, sortBy, type, invoiceType]);

  if (!isOpen) return null;

  // Toggle selection for multiple addition
  const toggleSelectItem = (key: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allKeys = new Set(filteredItems.map(item => getItemKey(item)));
      setSelectedIds(allKeys);
    }
  };

  // Add single item handler
  const handleAddSingleClick = (item: any) => {
    const key = getItemKey(item);
    setAddedIds(prev => new Set(prev).add(key));
    onAddSingle(item);
  };

  // Add multiple items handler
  const handleAddMultipleClick = () => {
    const itemsToAdd = filteredItems.filter(item => selectedIds.has(getItemKey(item)));
    if (itemsToAdd.length === 0) return;
    onAddMultiple(itemsToAdd);
    setSelectedIds(new Set());
    onClose();
  };

  const isMaterialType = type === 'materials';
  const isEstimateType = type === 'estimatesOrProducts' && invoiceType === 'مبدئية';
  const isReadyProductType = type === 'estimatesOrProducts' && invoiceType === 'نهائية';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
              isMaterialType ? 'bg-blue-100 text-blue-600' :
              isEstimateType ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'
            }`}>
              {isMaterialType && <Package className="w-5 h-5" />}
              {isEstimateType && <FileText className="w-5 h-5" />}
              {isReadyProductType && <Factory className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                {isMaterialType && 'اختيار مواد من المخزن'}
                {isEstimateType && 'اختيار من التقديرات المعتمدة'}
                {isReadyProductType && 'اختيار منتجات من أوامر التصنيع'}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {filteredItems.length} متاح
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isMaterialType && 'اختر المواد لإدراجها في الفاتورة (المواد المضافة مسبقاً مستبعدة تلقائياً)'}
                {isEstimateType && 'اختر التقدير لإدراجه بالفاتورة المبدئية مع كامل أبعاده ومواصفاته'}
                {isReadyProductType && 'اختر منتجاً غير مباع من جدول أوامر التصنيع لإدراجه في الفاتورة النهائية'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={
                isMaterialType ? 'بحث باسم المادة، الرمز، الوحدة...' :
                isEstimateType ? 'بحث ببيان التقدير، الشاصية، الأبعاد...' :
                'بحث برقم السيريال S/N، البيان، الشاصية...'
              }
              className="w-full text-xs sm:text-sm pr-9 pl-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Unit Filter (For Materials) */}
          {isMaterialType && availableUnits.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> الوحدة:
              </span>
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="text-xs py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">كل الوحدات</option>
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter (For Estimates) */}
          {isEstimateType && estimateCategories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> التصنيف:
              </span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="text-xs py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">كل التصنيفات</option>
                {estimateCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Sorting Filter (Default: lastUpdated) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" /> الترتيب:
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="lastUpdated">الأحدث حسب آخر تحديث (افتراضي)</option>
              <option value="dateDesc">تاريخ الإنشاء (الأحدث أولاً)</option>
              <option value="dateAsc">تاريخ الإنشاء (الأقدم أولاً)</option>
            </select>
          </div>

          {/* Select All Checkbox Button */}
          {filteredItems.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{selectedIds.size === filteredItems.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
            </button>
          )}
        </div>

        {/* Modal Body: Items List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-600">
                {availableItems.length === 0
                  ? (isReadyProductType
                      ? 'لا توجد منتجات غير مباعة متاحة في أوامر التصنيع، أو جميع المنتجات مضافة للفاتورة بالفعل.'
                      : 'جميع البنود مضافة بالفعل إلى الفاتورة، أو لا توجد عناصر مسجلة.')
                  : 'لا توجد نتائج مطابقة لشروط البحث أو التصفية.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                >
                  إعادة ضبط البحث
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map(item => {
                const key = getItemKey(item);
                const isSelected = selectedIds.has(key);
                const isJustAdded = addedIds.has(key);

                return (
                  <div
                    key={key}
                    onClick={() => toggleSelectItem(key)}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Item Information */}
                    <div className="flex items-start gap-3 flex-1">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          toggleSelectItem(key);
                        }}
                        className="mt-0.5 text-slate-400 hover:text-blue-600 flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>

                      {/* Content by Type */}
                      <div className="flex-1 min-w-0">
                        {/* 1. Material Item */}
                        {isMaterialType && (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                {item.name}
                              </span>
                              {item.shortName && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                  {item.shortName}
                                </span>
                              )}
                              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                                {item.unit || 'قطعة'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                              <span>السعر الافتراضي: <strong className="text-slate-700 font-bold font-mono">{formatCurrency(item.defaultPrice)} د.ل</strong></span>
                              {item.worksOfIds?.length > 0 && (
                                <span className="text-slate-400">• مرتبطة بأعمال تصنيع</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. Estimate Item */}
                        {isEstimateType && (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                {item.desc}
                              </span>
                              {item.chassis && (
                                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                  الشاصية: {item.chassis}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                              {(item.length || item.width || item.height) && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono text-[11px]">
                                  الأبعاد: {item.length}×{item.width}×{item.height} م
                                </span>
                              )}
                              <span>سعر البيع: <strong className="text-emerald-700 font-bold font-mono">{formatCurrency(item.sellPrice)} د.ل</strong></span>
                              {(item.date || item.lastUpdated) && (
                                <div className="flex items-center gap-2">
                                  {item.date && (
                                    <span className="text-slate-400 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {parseDateSafely(item.date).toLocaleDateString('ar-LY')}
                                    </span>
                                  )}
                                  {item.lastUpdated && item.lastUpdated !== item.date && (
                                    <span className="text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5 text-blue-600" />
                                      تحديث: {parseDateSafely(item.lastUpdated).toLocaleDateString('ar-LY')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. Ready Product Item */}
                        {isReadyProductType && (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-sm bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-md border border-purple-200">
                                S/N: {item.serialNumber}
                              </span>
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                {item.desc}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${item.mfgStatus === 'جاهز' || item.status === 'جاهز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {item.mfgStatus || (item.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع')}
                              </span>
                              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                                غير مباعة
                              </span>
                              {item.woId && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                                  {item.woId}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                              {item.chassis && (
                                <span>الشاصية: <strong className="text-slate-700">{item.chassis}</strong></span>
                              )}
                              {(item.length || item.width || item.height) && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono text-[11px]">
                                  الأبعاد: {item.length}×{item.width}×{item.height} م
                                </span>
                              )}
                              {item.notes && (
                                <span>ملاحظات: <strong className="text-slate-600">{item.notes}</strong></span>
                              )}
                              {item.sellPrice > 0 && (
                                <span>سعر البيع: <strong className="text-slate-700 font-bold font-mono">{formatCurrency(item.sellPrice)} د.ل</strong></span>
                              )}
                              {(item.date || item.lastUpdated) && (
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {parseDateSafely(item.lastUpdated || item.date).toLocaleDateString('ar-LY')}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price & Single Add Action */}
                    <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                      <div className="text-left font-mono font-bold text-sm text-slate-800">
                        {isMaterialType && formatCurrency(item.defaultPrice) + ' د.ل'}
                        {isEstimateType && formatCurrency(item.sellPrice) + ' د.ل'}
                        {isReadyProductType && (item.sellPrice ? formatCurrency(item.sellPrice) + ' د.ل' : '')}
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleAddSingleClick(item);
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs ${
                          isJustAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-300 hover:border-transparent'
                        }`}
                        title="إضافة هذا البند مباشرة للفاتورة"
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تمت الإضافة</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {selectedIds.size > 0 ? (
              <span className="text-blue-700 font-bold">
                تم تحديد {selectedIds.size} عنصر
              </span>
            ) : (
              <span>انقر على أي عنصر لتحديده أو اضغط زر "+ إضافة" للإدراج الفوري</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors"
            >
              إغلاق
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleAddMultipleClick}
                className="text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة العناصر المحددة ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
