import React,
  { useContext } from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLetters } from '../../context/LettersContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useCustomers } from '../../context/CustomersContext';
import { FileText, Plus, Search, Check, Trash2, Printer, Calendar, List, Grid, X, Eye, ArrowUp, ArrowDown, Edit, MoveUp, MoveDown, ChevronsUpDown, ChevronUp, ChevronDown, Save, Download, Database } from 'lucide-react';

import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';
import { ExportFilterModal } from '../../components/ui/ExportFilterModal';
import type { ExportFilters } from '../../components/ui/ExportFilterModal';

export const LettersView = ({ searchTerm = '' }: any) => { 
  const { hasPermission } = useAuth();
    const { letters, setLetters } = useLetters();
    const { appSettings, setAppSettings, idCountersRef, generateId } = useSettings();
    const { printData, setPrintData } = usePrint();
    const { customers, setCustomers } = useCustomers();
    const [isCreating, setIsCreating] = useLocalStorage('shams_letters_create', false);
    const [letterForm, setLetterForm] = useState({ 
      subject: '', customerId: '', senderName: '', senderTitle: '', 
      blocks: []
    });
    const [editingLetterId, setEditingLetterId] = useState(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    
    const handleEditLetter = (letter) => {
      setLetterForm({
        subject: letter.subject || '',
        customerId: letter.customerId || '',
        senderName: letter.senderName || '',
        senderTitle: letter.senderTitle || '',
        blocks: letter.blocks ? JSON.parse(JSON.stringify(letter.blocks)) : []
      });
      setEditingLetterId(letter.id);
      setIsCreating(true);
    };
    const [focusBlockId, setFocusBlockId] = useState(null);
    const addMenuRef = useRef(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const [sortConfig, setSortConfig] = useLocalStorage('letters_sortConfig', { key: 'date', direction: 'desc' });
    const [showExportModal, setShowExportModal] = useState(false);
    const [viewMode, setViewMode] = useLocalStorage('letters_viewMode', 'table');
    const [showLegacyImport, setShowLegacyImport] = useState(false);
    const [legacyForm, setLegacyForm] = useState({ id: '', date: new Date().toISOString().split('T')[0], customerName: '', subject: '' });
    const [legacyAutoId, setLegacyAutoId] = useState(true);

    const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
      setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 inline text-slate-300 mx-1" />;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline text-blue-500 mx-1" /> : <ChevronDown className="w-3 h-3 inline text-blue-500 mx-1" />;
    };

    useEffect(() => {
      if (focusBlockId) {
        const el = document.getElementById(`block-${focusBlockId}`);
        if (el) {
          el.focus();
          setFocusBlockId(null);
        }
      }
    }, [focusBlockId, letterForm.blocks]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (addMenuRef.current && !addMenuRef.current.contains(event.target)) setShowAddMenu(false);
      };
      if (showAddMenu) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAddMenu]);

    const handleAddMenuKeyDown = (e) => {
      if (!showAddMenu) return;
      const buttons = addMenuRef.current?.querySelectorAll('button.add-opt');
      if (!buttons || buttons.length === 0) return;
      const currentIndex = Array.from(buttons).findIndex(b => b === document.activeElement);
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
        buttons[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
        buttons[prev].focus();
      } else if (e.key === 'Escape') {
        setShowAddMenu(false);
        const mainBtn = addMenuRef.current?.querySelector('button.add-main');
        if (mainBtn) mainBtn.focus();
      }
    };
    useEffect(() => {
      const handler = e => {
        const currentTab = window.localStorage.getItem('shams_activeTab')?.replace(/"/g, '');
        if (e.key === 'Escape') {
          if (showLegacyImport) setShowLegacyImport(false);
          else if (isCreating && currentTab === 'invoices') setIsCreating(false);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [isCreating, showLegacyImport]);

    const addBlock = (type) => {
      const newBlock = { 
        id: Date.now().toString(), 
        type, 
        content: type === 'table' ? { headers: ['البيان', 'الكمية', 'الملاحظات'], rows: [['', '', '']] } : type === 'list' ? [''] : '' 
      };
      setLetterForm({...letterForm, blocks: [...letterForm.blocks, newBlock]});
      setFocusBlockId(newBlock.id);
    };

    const updateBlock = (id, content) => {
      setLetterForm({...letterForm, blocks: letterForm.blocks.map(b => b.id === id ? { ...b, content } : b)});
    };

    const removeBlock = (id) => {
      setLetterForm({...letterForm, blocks: letterForm.blocks.filter(b => b.id !== id)});
    };

    const moveBlock = (index, dir) => {
      const newBlocks = [...letterForm.blocks];
      if (dir === 'up' && index > 0) {
        [newBlocks[index-1], newBlocks[index]] = [newBlocks[index], newBlocks[index-1]];
      } else if (dir === 'down' && index < newBlocks.length - 1) {
        [newBlocks[index], newBlocks[index+1]] = [newBlocks[index+1], newBlocks[index]];
      }
      setLetterForm({...letterForm, blocks: newBlocks});
    };

    const handleSave = () => { 
    if (!hasPermission('invoices', 'create') && !hasPermission('invoices', 'edit')) return alert('ليس لديك صلاحية');
      if (!letterForm.subject || !letterForm.customerId) return alert('الرجاء إدخال الموضوع والزبون.');
      const cust = customers.find(c => c.id === letterForm.customerId);
      
      let savedLetter;
      
      if (editingLetterId) {
        savedLetter = letters.find(l => l.id === editingLetterId);
        if (savedLetter) {
          savedLetter = {
            ...savedLetter,
            ...letterForm,
            customerName: cust ? cust.name : 'بدون اسم',
            lastUpdated: new Date().toISOString()
          };
          setLetters(letters.map(l => l.id === editingLetterId ? savedLetter : l));
        }
      } else {
        savedLetter = {
          id: generateId('letter', cust ? cust.name : 'بدون اسم', letterForm.subject),
          date: new Date().toISOString(),
          ...letterForm,
          customerName: cust ? cust.name : 'بدون اسم'
        };
        setLetters([savedLetter, ...letters]);
      }
      
      setLetterForm({ 
        subject: '', customerId: '', senderName: '', senderTitle: '', 
        blocks: []
      });
      setEditingLetterId(null);
      setIsCreating(false);
      if (savedLetter) setPrintData({ type: 'LETTER', data: savedLetter });
    };

    const handleSaveAsNew = () => {
      if (!letterForm.subject || !letterForm.customerId) return alert('الرجاء إدخال الموضوع والزبون.');
      const cust = customers.find(c => c.id === letterForm.customerId);
      const newLetter = {
        id: generateId('letter', cust ? cust.name : 'بدون اسم', letterForm.subject),
        date: new Date().toISOString(),
        ...letterForm,
        customerName: cust ? cust.name : 'بدون اسم'
      };
      setLetters([newLetter, ...letters]);
      setLetterForm({ 
        subject: '', customerId: '', senderName: '', senderTitle: '', 
        blocks: []
      });
      setEditingLetterId(null);
      setIsCreating(false);
      setPrintData({ type: 'LETTER', data: newLetter });
    };

    const handleSaveLegacy = () => {
      if ((!legacyAutoId && !legacyForm.id) || !legacyForm.customerName || !legacyForm.subject || !legacyForm.date) {
        return alert('الرجاء إدخال جميع الحقول المطلوبة.');
      }
      
      const finalId = legacyAutoId 
        ? generateId('letter', legacyForm.customerName, legacyForm.subject) 
        : legacyForm.id;
        
      const newLetter = {
        id: finalId,
        date: new Date(legacyForm.date).toISOString(),
        customerName: legacyForm.customerName,
        subject: legacyForm.subject,
        customerId: '',
        senderName: '',
        senderTitle: '',
        blocks: []
      };
      setLetters([newLetter, ...letters]);
      setLegacyForm({ id: '', date: new Date().toISOString().split('T')[0], customerName: '', subject: '' });
      setShowLegacyImport(false);
      setLegacyAutoId(true);
      alert('تم إدراج السجل بنجاح.');
    };

    const filteredLetters = useMemo(() => {
      let filtered = letters.filter(l => 
        l.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );

      filtered.sort((a, b) => {
        let valA, valB;
        switch (sortConfig.key) {
          case 'id': valA = a.id; valB = b.id; break;
          case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
          case 'customerName': valA = a.customerName; valB = b.customerName; break;
          case 'subject': valA = a.subject; valB = b.subject; break;
          default: valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    }, [letters, searchTerm, sortConfig]);

    const paginatedLetters = filteredLetters.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const totalLettersPages = Math.ceil(filteredLetters.length / rowsPerPage);

    const exportLettersToExcel = (filters: ExportFilters) => {
      let data = filteredLetters;
      if (filters.dateFrom) data = data.filter(l => new Date(l.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(l => new Date(l.date) <= new Date(filters.dateTo + 'T23:59:59'));
      const headers = ['الرقم الإشاري', 'التاريخ', 'إلى (الجهة)', 'الموضوع'];
      const rows = data.map(letter => [
        letter.id || '',
        letter.date ? new Date(letter.date).toLocaleDateString('en-GB') : '',
        letter.customerName || '',
        letter.subject || ''
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الرسائل والمخاطبات");
      XLSX.writeFile(wb, `الرسائل_والمخاطبات_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    if (isCreating) {
      return (
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center border-b pb-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-800">{editingLetterId ? `تعديل رسالة (${editingLetterId})` : 'إنشاء رسالة / مخاطبة / عرض سعر'}</h2>
            <button onClick={() => { setIsCreating(false); setEditingLetterId(null); setLetterForm({ subject: '', customerId: '', senderName: '', senderTitle: '', blocks: [] }); }} className="text-slate-500 hover:text-slate-800"><X className="w-6 h-6" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="z-50 relative">
              <label className="block text-sm font-bold text-slate-700 mb-2">إلى السادة (الزبون / الجهة) *</label>
              <CustomerSelect value={letterForm.customerId} onChange={v => setLetterForm({...letterForm, customerId: v})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">الموضوع (عنوان الرسالة) *</label>
              <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold" placeholder="مثال: عرض سعر لتصنيع كرفان..." value={letterForm.subject} onChange={e => setLetterForm({...letterForm, subject: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المرسل / الموقّع</label>
              <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" placeholder="مثال: م. أحمد محمد" value={letterForm.senderName} onChange={e => setLetterForm({...letterForm, senderName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">صفة المرسل (المنصب)</label>
              <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" placeholder="مثال: المدير العام" value={letterForm.senderTitle} onChange={e => setLetterForm({...letterForm, senderTitle: e.target.value})} />
            </div>
          </div>
          
          {/* Blocks Renderer */}
          <div className="space-y-6 mb-6">
            {letterForm.blocks.map((block, index) => (
              <div key={block.id} className="relative group bg-white border border-slate-200 rounded-lg p-4 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
                
                {/* Controls */}
                <div className="absolute -right-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveBlock(index, 'up')} disabled={index===0} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                  <button onClick={() => moveBlock(index, 'down')} disabled={index===letterForm.blocks.length-1} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                  <button onClick={() => removeBlock(block.id)} className="p-1.5 bg-red-100 hover:bg-red-200 rounded text-red-600 mt-2"><Trash2 className="w-4 h-4"/></button>
                </div>

                {/* Block Type Indicator */}
                <div className="text-xs font-bold text-slate-400 mb-2 uppercase flex justify-between">
                   <span>{block.type === 'header' ? 'عنوان رئيسي' : block.type === 'text' ? 'نص عادي' : block.type === 'table' ? 'جدول بيانات' : block.type === 'list' ? 'قائمة نقطية' : 'مجهول'}</span>
                </div>

                {/* Render Block Inputs */}
                {block.type === 'header' && (
                  <input id={`block-${block.id}`} type="text" className="w-full text-xl font-bold p-2 outline-none border-b border-dashed border-slate-300 focus:border-blue-500" placeholder="اكتب هنا..." value={block.content} onChange={e => updateBlock(block.id, e.target.value)} />
                )}
                
                {block.type === 'text' && (
                  <textarea id={`block-${block.id}`} className="w-full p-2 outline-none min-h-[100px] text-lg leading-relaxed resize-y" placeholder="اكتب هنا..." value={block.content} onChange={e => updateBlock(block.id, e.target.value)} />
                )}
                
                {block.type === 'list' && (
                  <div className="space-y-2">
                    {block.content.map((item, i) => (
                       <div key={i} className="flex items-start gap-2">
                         <span className="mt-2 text-blue-500 font-black">•</span>
                         <input id={i === 0 ? `block-${block.id}` : undefined} type="text" className="flex-1 p-2 outline-none border-b border-dashed border-slate-300 focus:border-blue-500" value={item} onChange={e => {
                            const newList = [...block.content];
                            newList[i] = e.target.value;
                            updateBlock(block.id, newList);
                         }} />
                         <button onClick={() => {
                            if(block.content.length <= 1) return;
                            updateBlock(block.id, block.content.filter((_, idx) => idx !== i));
                         }} className="p-2 text-red-400 hover:text-red-600"><X className="w-4 h-4"/></button>
                       </div>
                    ))}
                    <button onClick={() => updateBlock(block.id, [...block.content, ''])} className="text-sm font-bold text-blue-600 flex items-center gap-1 mt-2 p-2 hover:bg-blue-50 rounded"><Plus className="w-3 h-3"/> إضافة بند</button>
                  </div>
                )}
                
                {block.type === 'table' && (
                  <div className="overflow-x-auto bg-white border border-slate-300 rounded-lg p-2">
                    <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          {block.content.headers.map((h, i) => (
                            <th key={i} className="p-1 border border-slate-200">
                              <div className="flex items-center">
                                <input id={i === 0 ? `block-${block.id}` : undefined} type="text" className="w-full p-1 bg-transparent outline-none font-bold text-center" value={h} onChange={e => {
                                  const newHeaders = [...block.content.headers];
                                  newHeaders[i] = e.target.value;
                                  updateBlock(block.id, {...block.content, headers: newHeaders});
                                }} />
                                <button onClick={() => {
                                  if(block.content.headers.length <= 1) return;
                                  const newHeaders = block.content.headers.filter((_, idx) => idx !== i);
                                  const newRows = block.content.rows.map(r => r.filter((_, idx) => idx !== i));
                                  updateBlock(block.id, { headers: newHeaders, rows: newRows });
                                }} className="text-red-400 hover:text-red-600 p-1" title="حذف العمود"><X className="w-3 h-3" /></button>
                              </div>
                            </th>
                          ))}
                          <th className="w-10 p-1 border border-slate-200 text-center">
                            <button onClick={() => {
                              const newHeaders = [...block.content.headers, 'عمود جديد'];
                              const newRows = block.content.rows.map(r => [...r, '']);
                              updateBlock(block.id, { headers: newHeaders, rows: newRows });
                            }} className="text-blue-600 hover:text-blue-800 p-1" title="إضافة عمود"><Plus className="w-4 h-4 mx-auto" /></button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.content.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-0 border border-slate-200">
                                <input type="text" className="w-full p-2 outline-none focus:bg-blue-50" value={cell} onChange={e => {
                                  const newRows = [...block.content.rows];
                                  newRows[rIdx][cIdx] = e.target.value;
                                  updateBlock(block.id, {...block.content, rows: newRows});
                                }} />
                              </td>
                            ))}
                            <td className="p-1 border border-slate-200 text-center">
                              <button onClick={() => {
                                if(block.content.rows.length <= 1) return;
                                const newRows = block.content.rows.filter((_, idx) => idx !== rIdx);
                                updateBlock(block.id, {...block.content, rows: newRows});
                              }} className="text-red-400 hover:text-red-600 p-1" title="حذف الصف"><Trash2 className="w-4 h-4 mx-auto" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
</div>
                    <button onClick={() => {
                      const newRows = [...block.content.rows, Array(block.content.headers.length).fill('')];
                      updateBlock(block.id, {...block.content, rows: newRows});
                    }} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 p-2 mt-2"><Plus className="w-4 h-4" /> إضافة صف للجدول</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Block Menu */}
          <div className="flex items-center justify-center mb-10">
            <div className="relative" ref={addMenuRef} onKeyDown={handleAddMenuKeyDown}>
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                onFocus={() => setShowAddMenu(true)}
                className="add-main bg-slate-800 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform outline-none focus:ring-4 focus:ring-blue-500/50"
              >
                <Plus className="w-6 h-6"/>
              </button>
              
              {showAddMenu && (
                <div className="absolute top-1/2 -translate-y-1/2 right-full mr-2 bg-white border border-slate-200 shadow-xl rounded-xl p-2 flex flex-col gap-1 w-48 z-50 animate-in fade-in zoom-in-95">
                  <button onClick={() => { addBlock('header'); setShowAddMenu(false); }} className="add-opt text-right px-4 py-2 hover:bg-slate-50 focus:bg-slate-100 rounded font-bold text-slate-700 outline-none">عنوان رئيسي (Heading)</button>
                  <button onClick={() => { addBlock('text'); setShowAddMenu(false); }} className="add-opt text-right px-4 py-2 hover:bg-slate-50 focus:bg-slate-100 rounded font-bold text-slate-700 outline-none">نص عادي (Paragraph)</button>
                  <button onClick={() => { addBlock('list'); setShowAddMenu(false); }} className="add-opt text-right px-4 py-2 hover:bg-slate-50 focus:bg-slate-100 rounded font-bold text-slate-700 outline-none">قائمة نقطية (Bullets)</button>
                  <button onClick={() => { addBlock('table'); setShowAddMenu(false); }} className="add-opt text-right px-4 py-2 hover:bg-slate-50 focus:bg-slate-100 rounded font-bold text-slate-700 outline-none">جدول بيانات (Table)</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button onClick={() => { setIsCreating(false); setEditingLetterId(null); setLetterForm({ subject: '', customerId: '', senderName: '', senderTitle: '', blocks: [] }); }} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">إلغاء</button>
            {editingLetterId ? (
              <>
                <button onClick={handleSaveAsNew} className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2"><Plus className="w-5 h-5" /> حفظ كجديد</button>
                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"><Save className="w-5 h-5" /> حفظ التعديلات</button>
              </>
            ) : (
              <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"><Save className="w-5 h-5" /> حفظ ومعاينة الطباعة</button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <ExportFilterModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={exportLettersToExcel}
          title="تصدير الرسائل والمخاطبات"
        />
        {showLegacyImport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  إدراج سجل خارجي
                </h3>
                <button onClick={() => setShowLegacyImport(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-slate-700">الرقم الإشاري</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold">{legacyAutoId ? 'تلقائي' : 'يدوي'}</span>
                      <button 
                        onClick={() => setLegacyAutoId(!legacyAutoId)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${legacyAutoId ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-0.5 bottom-0.5 w-4 bg-white rounded-full transition-transform ${legacyAutoId ? 'right-0.5 translate-x-0' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    className={`w-full p-2 border border-slate-300 rounded outline-none text-sm ${legacyAutoId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'focus:border-blue-500'}`}
                    value={legacyAutoId ? 'سيتم توليد الرقم تلقائياً' : legacyForm.id} 
                    onChange={e => setLegacyForm({ ...legacyForm, id: e.target.value })} 
                    placeholder="مثال: MSG-2023-001" 
                    disabled={legacyAutoId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">التاريخ</label>
                  <input type="date" className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none text-sm" value={legacyForm.date} onChange={e => setLegacyForm({ ...legacyForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">إلى السادة (الجهة / الزبون)</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none text-sm" value={legacyForm.customerName} onChange={e => setLegacyForm({ ...legacyForm, customerName: e.target.value })} placeholder="اسم الجهة الموجه إليها الرسالة" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الموضوع</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none text-sm" value={legacyForm.subject} onChange={e => setLegacyForm({ ...legacyForm, subject: e.target.value })} placeholder="موضوع الرسالة" />
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setShowLegacyImport(false)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-200 text-sm font-bold">إلغاء</button>
                <button onClick={handleSaveLegacy} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold">إدراج السجل</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات">
              <Grid className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowLegacyImport(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 text-sm flex items-center gap-2"><Database className="w-4 h-4" /> إدراج سجل خارجي</button>
            <button onClick={() => { setEditingLetterId(null); setLetterForm({ subject: '', customerId: '', senderName: '', senderTitle: '', blocks: [] }); setIsCreating(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> إنشاء رسالة جديدة</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {viewMode === 'table' ? (
<div className="overflow-x-auto w-full">
<table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                <th className="p-4 w-32 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                <th className="p-4 w-48 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>إلى (الجهة) {getSortIcon('customerName')}</th>
                <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('subject')}>الموضوع {getSortIcon('subject')}</th>
                <th className="p-4 w-32 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLetters.map(letter => (
                <tr key={letter.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">{letter.id}</td>
                  <td className="p-4 whitespace-nowrap">{new Date(letter.date).toLocaleDateString('ar-LY')}</td>
                  <td className="p-4 font-bold">{letter.customerName}</td>
                  <td className="p-4">{letter.subject}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => setPrintData({ type: 'LETTER', data: letter })} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg" title="طباعة / تصدير PDF"><Printer className="w-5 h-5" /></button>
                    <button onClick={() => handleEditLetter(letter)} className="text-orange-500 hover:text-orange-700 bg-orange-50 p-2 rounded-lg mr-2" title="تعديل"><Edit className="w-5 h-5" /></button>
                    <button onClick={() => { if(window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) setLetters(letters.filter(l => l.id !== letter.id)) }} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg mr-2" title="حذف"><Trash2 className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))}
              {paginatedLetters.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">لا توجد رسائل مطابقة.</td></tr>
              )}
            </tbody>
          </table>
</div>
) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50/50">
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
                      <button onClick={() => handleEditLetter(letter)} className="text-orange-500 hover:bg-orange-50 p-1.5 rounded transition-colors" title="تعديل"><Edit className="w-4 h-4" /></button>
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
          </div>
)}
          
          {filteredLetters.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                  <Download className="w-4 h-4" /> تصدير Excel
                </button>
                <span className="text-sm text-slate-500 font-medium">
                  عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredLetters.length)} من {filteredLetters.length} رسالة
                </span>
              </div>
              {totalLettersPages > 1 && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    السابق
                  </button>
                  <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                    {currentPage} / {totalLettersPages}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalLettersPages, p + 1))} 
                    disabled={currentPage === totalLettersPages}
                    className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };