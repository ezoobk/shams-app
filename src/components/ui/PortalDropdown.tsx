import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatters';

export const PortalDropdown = ({ coords, suggestions, highlightedIndex, onSelect, onHover, isNew }: any) => {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  if (!coords) return null;
  return createPortal(
    <div ref={containerRef} style={{ position: 'absolute', top: coords.top + 4, left: coords.left, width: coords.width, zIndex: 99999 }} className="bg-white border border-slate-300 shadow-2xl rounded-lg max-h-56 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
      {suggestions.map((mm: any, idx: number) => (
        <div key={mm.id} className={`p-3 cursor-pointer flex justify-between items-center border-b border-slate-100 ${highlightedIndex === idx ? 'bg-blue-100' : 'hover:bg-blue-50'}`} onClick={() => onSelect(mm)} onMouseEnter={() => onHover(idx)}>
          <span className="font-semibold text-slate-700">{mm.name} {mm.shortName ? <span className="text-sm text-slate-400 bg-slate-100 px-1 rounded ml-1 font-normal">{mm.shortName}</span> : ''}</span>
          <span className="text-blue-600 text-sm font-bold dir-ltr">{formatCurrency(mm.defaultPrice)}</span>
        </div>
      ))}
      {isNew && (
        <div className={`p-3 text-sm flex justify-between cursor-pointer ${highlightedIndex === suggestions.length ? 'bg-blue-100 text-blue-700' : 'text-slate-500 bg-slate-50'}`} onClick={() => onSelect(null)} onMouseEnter={() => onHover(suggestions.length)}>
          <span>سيتم حفظها كمادة جديدة تلقائياً</span><span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">جديد</span>
        </div>
      )}
    </div>,
    document.body
  );
};
