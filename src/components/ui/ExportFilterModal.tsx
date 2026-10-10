import React, { useState } from 'react';
import { X, Download, Calendar, Hash } from 'lucide-react';

export interface ExportFilters {
  dateFrom: string;
  dateTo: string;
  refIdFrom?: string;
  refIdTo?: string;
  workOrderId?: string;
}

interface ExportFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (filters: ExportFilters) => void;
  title: string;
  showRefId?: boolean;
  showWorkOrderId?: boolean;
}

export const ExportFilterModal = ({ isOpen, onClose, onExport, title, showRefId = false, showWorkOrderId = false }: ExportFilterModalProps) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refIdFrom, setRefIdFrom] = useState('');
  const [refIdTo, setRefIdTo] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({ dateFrom, dateTo, refIdFrom, refIdTo, workOrderId });
    onClose();
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setRefIdFrom('');
    setRefIdTo('');
    setWorkOrderId('');
  };

  const hasFilters = dateFrom || dateTo || refIdFrom || refIdTo || workOrderId;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">حدد النطاق المطلوب تصديره (اتركها فارغة لتصدير الكل)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Date Range */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-700 text-sm">نطاق التاريخ</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">من تاريخ</label>
                <input
                  type="date"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm bg-slate-50"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm bg-slate-50"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Reference ID Range */}
          {showRefId && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-700 text-sm">نطاق الرقم الإشاري</span>
                <span className="text-xs text-slate-400">(اختياري)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">من الرقم</label>
                  <input
                    type="text"
                    placeholder="مثال: INV-001"
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-sm bg-slate-50 font-mono"
                    value={refIdFrom}
                    onChange={e => setRefIdFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">إلى الرقم</label>
                  <input
                    type="text"
                    placeholder="مثال: INV-100"
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-sm bg-slate-50 font-mono"
                    value={refIdTo}
                    onChange={e => setRefIdTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Work Order ID Filter */}
          {showWorkOrderId && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-orange-600" />
                <span className="font-bold text-slate-700 text-sm">رقم أمر العمل</span>
                <span className="text-xs text-slate-400">(اختياري)</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">رقم أمر العمل (جزئي أو كامل)</label>
                <input
                  type="text"
                  placeholder="مثال: WO-2026-001"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-orange-500 text-sm bg-slate-50 font-mono"
                  value={workOrderId}
                  onChange={e => setWorkOrderId(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between items-center">
          <button
            onClick={handleReset}
            disabled={!hasFilters}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            مسح الفلاتر
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm">
              إلغاء
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              تصدير Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
