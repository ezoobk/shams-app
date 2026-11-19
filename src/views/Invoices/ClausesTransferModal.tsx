import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ArrowRight, ArrowLeft, Check, Edit2, MoveUp, MoveDown, Search, FileText, CheckCircle2, ListPlus } from 'lucide-react';

interface ClausesTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentText: string;
  onSave: (newText: string) => void;
  savedLibrary: string[];
  onUpdateLibrary: (newLibrary: string[]) => void;
  defaultSuggestions?: string[];
}

export const ClausesTransferModal: React.FC<ClausesTransferModalProps> = ({
  isOpen,
  onClose,
  title,
  currentText,
  onSave,
  savedLibrary,
  onUpdateLibrary,
  defaultSuggestions = []
}) => {
  // Parse lines from current multiline text
  const parseLines = (text: string) => {
    if (!text) return [];
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  const [included, setIncluded] = useState<string[]>([]);
  const [library, setLibrary] = useState<string[]>([]);
  const [activeTabMobile, setActiveTabMobile] = useState<'included' | 'available'>('available');
  const [searchTerm, setSearchTerm] = useState('');
  const [newLibraryItemText, setNewLibraryItemText] = useState('');
  const [newDirectItemText, setNewDirectItemText] = useState('');
  const [editingLibraryIndex, setEditingLibraryIndex] = useState<number | null>(null);
  const [editingLibraryText, setEditingLibraryText] = useState('');
  const [editingIncludedIndex, setEditingIncludedIndex] = useState<number | null>(null);
  const [editingIncludedText, setEditingIncludedText] = useState('');
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawText, setRawText] = useState('');

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const parsed = parseLines(currentText);
      setIncluded(parsed);
      setRawText(currentText || '');

      // Ensure library has items, fallback to default suggestions if empty
      let initialLib = Array.isArray(savedLibrary) && savedLibrary.length > 0
        ? [...savedLibrary]
        : [...defaultSuggestions];

      // Remove empty strings
      initialLib = initialLib.map(i => i.trim()).filter(Boolean);
      setLibrary(initialLib);
      setSearchTerm('');
      setNewLibraryItemText('');
      setNewDirectItemText('');
      setEditingLibraryIndex(null);
      setEditingIncludedIndex(null);
      setIsRawMode(false);
      setActiveTabMobile(parsed.length > 0 ? 'included' : 'available');
    }
  }, [isOpen, currentText]);

  if (!isOpen) return null;

  // Items in library that are NOT in included
  const availableItems = library.filter(item => !included.includes(item));
  const filteredAvailable = availableItems.filter(item =>
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Transfer item from Available -> Included
  const handleIncludeItem = (itemText: string) => {
    if (!included.includes(itemText)) {
      setIncluded([...included, itemText]);
    }
  };

  // Transfer item from Included -> Available (Exclude from invoice)
  const handleExcludeItem = (index: number) => {
    const itemToExclude = included[index];
    const newIncluded = [...included];
    newIncluded.splice(index, 1);
    setIncluded(newIncluded);

    // If item was not in library, keep it available by adding to library optionally
    if (!library.includes(itemToExclude)) {
      const updatedLib = [...library, itemToExclude];
      setLibrary(updatedLib);
      onUpdateLibrary(updatedLib);
    }
  };

  // Reorder items in Included
  const handleMoveIncluded = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === included.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...included];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setIncluded(newItems);
  };

  // Add new item to Library
  const handleAddNewLibraryItem = () => {
    const text = newLibraryItemText.trim();
    if (!text) return;
    if (!library.includes(text)) {
      const updatedLib = [...library, text];
      setLibrary(updatedLib);
      onUpdateLibrary(updatedLib);
    }
    setNewLibraryItemText('');
  };

  // Add new item directly into Included
  const handleAddDirectIncludedItem = () => {
    const text = newDirectItemText.trim();
    if (!text) return;
    setIncluded([...included, text]);
    // Also save into library so it is available for future use
    if (!library.includes(text)) {
      const updatedLib = [...library, text];
      setLibrary(updatedLib);
      onUpdateLibrary(updatedLib);
    }
    setNewDirectItemText('');
  };

  // Delete item permanently from Library
  const handleDeleteFromLibrary = (itemText: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا النموذج من القائمة المحفوظة؟')) {
      const updatedLib = library.filter(i => i !== itemText);
      setLibrary(updatedLib);
      onUpdateLibrary(updatedLib);
    }
  };

  // Save edit of library item
  const handleSaveLibraryEdit = (indexInLib: number) => {
    const updatedText = editingLibraryText.trim();
    if (!updatedText) return;
    const oldText = library[indexInLib];
    const updatedLib = [...library];
    updatedLib[indexInLib] = updatedText;
    setLibrary(updatedLib);
    onUpdateLibrary(updatedLib);

    // Also update in included if present
    if (included.includes(oldText)) {
      setIncluded(included.map(i => i === oldText ? updatedText : i));
    }
    setEditingLibraryIndex(null);
    setEditingLibraryText('');
  };

  // Save edit of included item
  const handleSaveIncludedEdit = (index: number) => {
    const updatedText = editingIncludedText.trim();
    if (!updatedText) return;
    const updatedIncluded = [...included];
    updatedIncluded[index] = updatedText;
    setIncluded(updatedIncluded);
    setEditingIncludedIndex(null);
    setEditingIncludedText('');
  };

  // Apply and save
  const handleConfirmSave = () => {
    if (isRawMode) {
      onSave(rawText);
    } else {
      onSave(included.join('\n'));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400">
              <ListPlus className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">{title}</h2>
              <p className="text-xs text-slate-400 hidden sm:block">
                اختر البنود من النماذج لنقلها إلى الفاتورة، أو أضف بنوداً جديدة وعدّلها بكل سهولة.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRawMode(!isRawMode)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {isRawMode ? 'العودة لنظام الأعمدة' : 'محرر النص الحر'}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isRawMode ? (
          /* Raw Text Mode */
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
            <div className="mb-2 flex justify-between items-center">
              <label className="text-sm font-bold text-slate-700">تحرير النص بالكامل مباشرة:</label>
              <span className="text-xs text-slate-500">كل سطر يمثل بنداً منفصلاً</span>
            </div>
            <textarea
              className="w-full h-80 border border-slate-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500 font-sans"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="اكتب كل سطر أو شرط في سطر مستقل..."
            />
          </div>
        ) : (
          /* Transfer Column Mode */
          <div className="flex-1 overflow-hidden flex flex-col p-3 sm:p-5">
            
            {/* Mobile Tab Switcher (< 768px) */}
            <div className="flex md:hidden bg-slate-100 p-1 rounded-xl mb-3 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTabMobile('included')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTabMobile === 'included'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>المدرج في الفاتورة</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabMobile === 'included' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {included.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMobile('available')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTabMobile === 'available'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>غير مدرج (النماذج)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabMobile === 'available' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {availableItems.length}
                </span>
              </button>
            </div>

            {/* Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              
              {/* --- Column 1: Unincluded / Available Library --- */}
              <div className={`flex flex-col border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden ${
                activeTabMobile === 'available' ? 'flex' : 'hidden md:flex'
              }`}>
                {/* Header */}
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">غير مدرج (النماذج المتاحة)</span>
                    <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
                      {availableItems.length}
                    </span>
                  </div>
                  {included.length > 0 && availableItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIncluded([...included, ...availableItems])}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                    >
                      إدراج الكل
                    </button>
                  )}
                </div>

                {/* Search & Add New to Library */}
                <div className="p-2.5 bg-white border-b border-slate-200 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                    <input
                      type="text"
                      className="w-full pr-8 pl-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      placeholder="بحث في النماذج..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="flex-1 p-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                      placeholder="+ كتابة نموذج جديد لحفظه..."
                      value={newLibraryItemText}
                      onChange={e => setNewLibraryItemText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddNewLibraryItem(); }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewLibraryItem}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> حفظ
                    </button>
                  </div>
                </div>

                {/* Available Items List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {filteredAvailable.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                      {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'جميع النماذج مدرجة بالفعل في الفاتورة أو القائمة فارغة.'}
                    </div>
                  ) : (
                    filteredAvailable.map((item, idx) => {
                      const libIdx = library.indexOf(item);
                      const isEditing = editingLibraryIndex === libIdx;

                      return (
                        <div
                          key={`avail-${idx}`}
                          className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs hover:border-blue-300 transition-all flex flex-col gap-2 group"
                        >
                          {isEditing ? (
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                className="flex-1 p-1 text-xs border border-blue-400 rounded outline-none"
                                value={editingLibraryText}
                                onChange={e => setEditingLibraryText(e.target.value)}
                              />
                              <button
                                onClick={() => handleSaveLibraryEdit(libIdx)}
                                className="p-1 bg-green-500 text-white rounded text-xs"
                                title="حفظ"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingLibraryIndex(null)}
                                className="p-1 bg-slate-200 text-slate-600 rounded text-xs"
                                title="إلغاء"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-xs text-slate-700 leading-relaxed font-medium flex-1">
                                {item}
                              </p>
                              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLibraryIndex(libIdx);
                                    setEditingLibraryText(item);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                                  title="تعديل النموذج"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFromLibrary(item)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                  title="حذف النموذج"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleIncludeItem(item)}
                            className="w-full mt-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-200 hover:border-transparent"
                          >
                            <span>إدراج للفاتورة</span>
                            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* --- Column 2: Included in Invoice --- */}
              <div className={`flex flex-col border border-blue-200 rounded-xl bg-blue-50/20 overflow-hidden ${
                activeTabMobile === 'included' ? 'flex' : 'hidden md:flex'
              }`}>
                {/* Header */}
                <div className="p-3 bg-blue-50 border-b border-blue-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">المدرج في الفاتورة الحالية</span>
                    <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      {included.length}
                    </span>
                  </div>
                  {included.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIncluded([])}
                      className="text-xs text-red-600 hover:text-red-800 font-bold"
                    >
                      استبعاد الكل
                    </button>
                  )}
                </div>

                {/* Direct Add to Invoice */}
                <div className="p-2.5 bg-white border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="flex-1 p-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                      placeholder="+ إضافة شرط مخصص لهذه الفاتورة..."
                      value={newDirectItemText}
                      onChange={e => setNewDirectItemText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddDirectIncludedItem(); }}
                    />
                    <button
                      type="button"
                      onClick={handleAddDirectIncludedItem}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة
                    </button>
                  </div>
                </div>

                {/* Included Items List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {included.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                      لم يتم إدراج أي سطور بعد. اختر من قائمة "غير مدرج" لإدراج النماذج بنقرة واحدة.
                    </div>
                  ) : (
                    included.map((item, idx) => {
                      const isEditing = editingIncludedIndex === idx;

                      return (
                        <div
                          key={`incl-${idx}`}
                          className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-2"
                        >
                          {isEditing ? (
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                className="flex-1 p-1 text-xs border border-blue-400 rounded outline-none"
                                value={editingIncludedText}
                                onChange={e => setEditingIncludedText(e.target.value)}
                              />
                              <button
                                onClick={() => handleSaveIncludedEdit(idx)}
                                className="p-1 bg-green-500 text-white rounded text-xs"
                                title="حفظ"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingIncludedIndex(null)}
                                className="p-1 bg-slate-200 text-slate-600 rounded text-xs"
                                title="إلغاء"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <p className="text-xs text-slate-800 leading-relaxed font-semibold flex-1">
                                {item}
                              </p>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleMoveIncluded(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 rounded"
                                  title="تحريك لأعلى"
                                >
                                  <MoveUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveIncluded(idx, 'down')}
                                  disabled={idx === included.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 rounded"
                                  title="تحريك لأسفل"
                                >
                                  <MoveDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingIncludedIndex(idx);
                                    setEditingIncludedText(item);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                  title="تعديل هذا السطر"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleExcludeItem(idx)}
                            className="w-full mt-1 py-1.5 px-3 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-red-200 hover:border-transparent"
                          >
                            <span>استبعاد من الفاتورة</span>
                            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-right">
            <span>عدد البنود التي ستظهر في الفاتورة: </span>
            <span className="font-bold text-blue-600">{included.length} بنود</span>
          </div>
          <div className="flex gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>تطبيق وحفظ الفاتورة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
