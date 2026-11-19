import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDrivers } from '../../context/DriversContext';
import { Search, ChevronDown, Plus, Edit, Check, Trash2, X } from 'lucide-react';

export const DriverSelect = ({ value, onChange, direction = 'down' }: { value?: string; onChange: (id: string) => void; direction?: 'up' | 'down' }) => {
    const { drivers, setDrivers } = useDrivers();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
    const [newDriverData, setNewDriverData] = useState({ name: '', truckNumber: '', trailerNumber: '', license: '' });

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (editingDriverId) setEditingDriverId(null);
          else if (isOpen) setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen, editingDriverId]);

    const selectedDriver = drivers.find(d => d.id === value);
    const filteredDrivers = drivers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || (d.truckNumber && d.truckNumber.toLowerCase().includes(search.toLowerCase())));

    const handleQuickCreate = () => {
      setNewDriverData({ name: search, truckNumber: '', trailerNumber: '', license: '' });
      setEditingDriverId('new');
    };

    const handleEditDriver = (e: React.MouseEvent, d: any) => {
      e.stopPropagation();
      setNewDriverData({ name: d.name || '', truckNumber: d.truckNumber || '', trailerNumber: d.trailerNumber || '', license: d.license || '' });
      setEditingDriverId(d.id);
    };

    const confirmSave = () => {
      if (!newDriverData.name || !newDriverData.truckNumber) return alert('الرجاء إدخال اسم السائق ورقم الشاحنة');
      
      if (editingDriverId === 'new') {
        const newDriver = { id: `D${Date.now()}`, ...newDriverData };
        setDrivers([newDriver, ...drivers]);
        onChange(newDriver.id);
      } else {
        setDrivers(drivers.map(d => d.id === editingDriverId ? { ...d, ...newDriverData } : d));
        onChange(editingDriverId);
      }
      setIsOpen(false);
      setEditingDriverId(null);
      setSearch('');
    };

    return (
      <div className={`relative w-full ${isOpen ? 'z-40' : 'z-10'}`} ref={wrapperRef}>
        <div
          className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-slate-100/70 cursor-pointer flex justify-between items-center transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={selectedDriver ? "text-slate-800 font-bold" : "text-slate-500"}>
            {selectedDriver ? `${selectedDriver.name} ${selectedDriver.truckNumber ? `(${selectedDriver.truckNumber})` : ''}` : '-- اختر السائق أو اكتب لإضافة جديد --'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </div>

        {isOpen && !editingDriverId && (
          <div className={`absolute z-50 right-0 w-full min-w-full sm:min-w-[360px] max-w-full sm:max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
            <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  placeholder="ابحث بالاسم أو رقم الشاحنة..."
                  className="w-full pl-2 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button onClick={handleQuickCreate} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-colors">
                <Plus className="w-3.5 h-3.5" /> جديد
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {filteredDrivers.length > 0 ? (
                filteredDrivers.map(d => (
                  <div
                    key={d.id}
                    className={`p-3 cursor-pointer hover:bg-blue-50/80 flex justify-between items-start gap-2 group transition-colors ${value === d.id ? 'bg-blue-50' : ''}`}
                    onClick={() => { onChange(d.id); setIsOpen(false); setSearch(''); }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold text-sm ${value === d.id ? 'text-blue-700' : 'text-slate-800'}`}>{d.name}</div>
                      <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-1.5">
                        {d.truckNumber && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono text-[11px]">
                            شاحنة: <strong className="text-slate-900">{d.truckNumber}</strong>
                          </span>
                        )}
                        {d.trailerNumber && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono text-[11px]">
                            مقطورة: <strong className="text-slate-900">{d.trailerNumber}</strong>
                          </span>
                        )}
                        {d.license && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono text-[11px]">
                            رخصة: <strong className="text-slate-900">{d.license}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleEditDriver(e, d)}
                      className="p-1.5 bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                      title="تعديل بيانات السائق"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : search.trim() !== '' ? (
                <div
                  className="px-4 py-3 cursor-pointer hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 font-semibold text-sm"
                  onClick={handleQuickCreate}
                >
                  <Plus className="w-4 h-4" /> إضافة "{search}" كسائق جديد
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-400">لا يوجد سائقين مسجلين.</div>
              )}
            </div>
          </div>
        )}
        
        {editingDriverId && createPortal(
          <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h3 className="font-bold text-slate-800">{editingDriverId === 'new' ? 'إضافة سائق جديد' : 'تعديل بيانات السائق'}</h3>
                <button onClick={() => setEditingDriverId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">اسم السائق / الناقل *</label>
                  <input type="text" autoFocus className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newDriverData.name} onChange={e => setNewDriverData({...newDriverData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رقم الشاحنة / اللوحة *</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newDriverData.truckNumber} onChange={e => setNewDriverData({...newDriverData, truckNumber: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رقم المقطورة (اختياري)</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newDriverData.trailerNumber} onChange={e => setNewDriverData({...newDriverData, trailerNumber: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رقم الرخصة (اختياري)</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newDriverData.license} onChange={e => setNewDriverData({...newDriverData, license: e.target.value})} />
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                <button onClick={() => setEditingDriverId(null)} className="px-4 py-2 rounded font-bold text-slate-600 hover:bg-slate-200">إلغاء</button>
                <button onClick={confirmSave} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">حفظ</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };


