import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { useCustomers } from '../../context/CustomersContext';

export const CustomerSelect = ({ value, onChange, direction = 'down' }: { value: string, onChange: (id: string) => void, direction?: 'up' | 'down' }) => {
  const { customers, setCustomers } = useCustomers();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedCustomer = customers.find(c => c.id === value);
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search)));

  const handleQuickCreate = () => {
    const newCustomer = { id: `C${Date.now()}`, name: search, phone: '', notes: '' };
    setCustomers([newCustomer, ...customers]);
    onChange(newCustomer.id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative flex-1 min-w-[250px]" ref={wrapperRef}>
      <div
        className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedCustomer ? "text-slate-800 font-bold" : "text-slate-500"}>
          {selectedCustomer ? selectedCustomer.name : '-- اختر الزبون أو اكتب لإضافة جديد --'}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </div>

      {isOpen && (
        <div className={`absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-2 top-2" />
              <input
                type="text"
                autoFocus
                placeholder="ابحث بالاسم أو اكتب اسماً جديداً..."
                className="w-full pl-2 pr-8 py-1.5 border border-slate-300 rounded text-sm outline-none focus:border-blue-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map(c => (
                <div
                  key={c.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 ${value === c.id ? 'bg-blue-50 text-blue-700 font-bold' : ''}`}
                  onClick={() => { onChange(c.id); setIsOpen(false); setSearch(''); }}
                >
                  <div>{c.name}</div>
                  {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                </div>
              ))
            ) : search.trim() !== '' ? (
              <div
                className="px-4 py-3 cursor-pointer hover:bg-emerald-50 text-emerald-700 border-b border-slate-50 flex items-center gap-2 font-semibold"
                onClick={handleQuickCreate}
              >
                <Plus className="w-4 h-4" /> إضافة "{search}" كعميل جديد
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-slate-500">لا يوجد عملاء.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
