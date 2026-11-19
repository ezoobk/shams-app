import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Clock, CheckCheck, RotateCcw, Factory, Calendar, AlertCircle, Sparkles } from 'lucide-react';
import type { WorkOrderSectionStatus } from '../../types';
import { calculateDurationDays, formatDurationDaysAr, parseDateSafely } from '../../utils/formatters';

interface WorkOrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  woId?: string;
  woDate?: string;
  worksOf: any[];
  onSave: (statuses: WorkOrderSectionStatus[], newMfgStatus: string) => void;
}

// Format date to local YYYY-MM-DDTHH:mm for datetime-local input
const getNowLocalISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Format date for readable Arabic display
const formatReadableDateTime = (isoString?: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('ar-LY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

export const WorkOrderStatusModal: React.FC<WorkOrderStatusModalProps> = ({
  isOpen,
  onClose,
  item,
  woId,
  woDate,
  worksOf,
  onSave
}) => {
  const [sections, setSections] = useState<WorkOrderSectionStatus[]>([]);

  const startDateRef = woDate || item?._woDate || item?.date;

  // Initialize sections whenever modal opens or item changes
  useEffect(() => {
    if (!isOpen || !item) return;

    // Collect all section definitions: from worksOf + any sections in item materials
    const sectionsMap = new Map<string, string>();
    (worksOf || []).forEach(w => {
      if (w?.id) sectionsMap.set(String(w.id), w.name || 'قسم بدون اسم');
    });

    if (Array.isArray(item.materials)) {
      item.materials.forEach((m: any) => {
        if (m?.worksOf && !sectionsMap.has(String(m.worksOf))) {
          sectionsMap.set(String(m.worksOf), m.worksOfName || `قسم ${m.worksOf}`);
        }
      });
    }

    // Existing saved section statuses
    const existingStatuses = new Map<string, WorkOrderSectionStatus>();
    if (Array.isArray(item.sectionStatuses)) {
      item.sectionStatuses.forEach((s: WorkOrderSectionStatus) => {
        if (s?.sectionId) existingStatuses.set(String(s.sectionId), s);
      });
    }

    const isInitiallyReady = item.mfgStatus === 'جاهز' || item.status === 'جاهز';
    const fallbackReadyDate = item.completedAt || getNowLocalISO();

    const mergedSections: WorkOrderSectionStatus[] = [];
    sectionsMap.forEach((secName, secId) => {
      const existing = existingStatuses.get(secId);
      if (existing) {
        mergedSections.push({
          sectionId: secId,
          sectionName: secName,
          isCompleted: Boolean(existing.isCompleted),
          completedAt: existing.completedAt || (existing.isCompleted ? fallbackReadyDate : undefined),
          durationDays: existing.durationDays
        });
      } else {
        mergedSections.push({
          sectionId: secId,
          sectionName: secName,
          isCompleted: isInitiallyReady,
          completedAt: isInitiallyReady ? fallbackReadyDate : undefined
        });
      }
    });

    // Also include any previously saved sections that might have been deleted from master worksOf
    existingStatuses.forEach((existing, secId) => {
      if (!sectionsMap.has(secId)) {
        mergedSections.push(existing);
      }
    });

    setSections(mergedSections);
  }, [isOpen, item, worksOf]);

  // Count materials per section
  const sectionMaterialCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (item && Array.isArray(item.materials)) {
      item.materials.forEach((m: any) => {
        if (m.isVisible === false) return;
        const key = String(m.worksOf || 'other');
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    }
    return counts;
  }, [item]);

  if (!isOpen || !item) return null;

  const completedCount = sections.filter(s => s.isCompleted).length;
  const totalCount = sections.length;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Overall completion duration when all sections are completed
  const latestCompletionDate = (() => {
    if (!isAllCompleted) return null;
    const dates = sections
      .filter(s => s.isCompleted && s.completedAt)
      .map(s => ({ raw: s.completedAt!, ts: parseDateSafely(s.completedAt).getTime() }))
      .filter(d => d.ts > 0)
      .sort((a, b) => b.ts - a.ts);
    return dates.length > 0 ? dates[0].raw : null;
  })();
  const totalDurationDays = latestCompletionDate ? calculateDurationDays(startDateRef, latestCompletionDate) : null;
  const totalDurationText = totalDurationDays !== null ? formatDurationDaysAr(totalDurationDays) : '';

  // Toggle single section
  const handleToggleSection = (sectionId: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.sectionId === sectionId) {
        const nextState = !sec.isCompleted;
        const nextCompletedAt = nextState ? (sec.completedAt || getNowLocalISO()) : undefined;
        const durationDays = nextState && nextCompletedAt
          ? (calculateDurationDays(startDateRef, nextCompletedAt) ?? undefined)
          : undefined;
        return {
          ...sec,
          isCompleted: nextState,
          completedAt: nextCompletedAt,
          durationDays
        };
      }
      return sec;
    }));
  };

  // Change completion date
  const handleDateChange = (sectionId: string, newDate: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.sectionId === sectionId) {
        const durationDays = sec.isCompleted && newDate
          ? (calculateDurationDays(startDateRef, newDate) ?? undefined)
          : undefined;
        return {
          ...sec,
          completedAt: newDate,
          durationDays
        };
      }
      return sec;
    }));
  };

  // Toggle all sections
  const handleToggleAll = (markAsCompleted: boolean) => {
    const nowIso = getNowLocalISO();
    setSections(prev => prev.map(sec => {
      const nextCompletedAt = markAsCompleted ? (sec.completedAt || nowIso) : undefined;
      const durationDays = markAsCompleted && nextCompletedAt
        ? (calculateDurationDays(startDateRef, nextCompletedAt) ?? undefined)
        : undefined;
      return {
        ...sec,
        isCompleted: markAsCompleted,
        completedAt: nextCompletedAt,
        durationDays
      };
    }));
  };

  const handleSave = () => {
    const newMfgStatus = isAllCompleted ? 'جاهز' : 'قيد التصنيع';
    const enrichedSections = sections.map(sec => ({
      ...sec,
      durationDays: sec.isCompleted && sec.completedAt
        ? (calculateDurationDays(startDateRef, sec.completedAt) ?? sec.durationDays)
        : undefined
    }));
    onSave(enrichedSections, newMfgStatus);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
              <Factory className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">متابعة حالة أقسام التصنيع</h2>
              <p className="text-xs text-slate-400 mt-0.5">تحديد حالة كل قسم بدقة وتوثيق تاريخ الإنجاز</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Info Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {woId && <span className="font-mono text-xs font-bold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">{woId}</span>}
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">SN: {item.serialNumber}</span>
                {item.chassis && <span className="text-xs text-slate-500 font-medium">| شاصية: {item.chassis}</span>}
              </div>
              <h3 className="font-black text-slate-800 text-base truncate">{item.desc}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                {(item.length || item.width || item.height) && (
                  <span>الأبعاد: {item.length}x{item.width}x{item.height} م</span>
                )}
                {startDateRef && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    تاريخ البدء: {new Date(startDateRef).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>
            </div>

            {/* Current / Projected Status Badge */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">الحالة الإجمالية الحالية</span>
              <span className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${
                isAllCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                {isAllCompleted ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {isAllCompleted ? 'جاهز بالكامل' : 'قيد التصنيع'}
              </span>
              {isAllCompleted && totalDurationText && (
                <span className="text-[11px] font-bold text-emerald-700 mt-1">
                  مدة الإنجاز: {totalDurationText}
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar & Summary */}
          <div className="mt-4 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-600 flex items-center gap-1">
                <span>نسبة الإنجاز:</span>
                <span className="text-blue-600 font-black">{progressPercent}%</span>
                <span className="text-slate-400 font-normal">({completedCount} من {totalCount} أقسام مكتملة)</span>
              </span>
              {isAllCompleted ? (
                <span className="text-emerald-600 flex items-center gap-1 font-black">
                  <Sparkles className="w-3.5 h-3.5" /> جاهز للتسليم
                </span>
              ) : (
                <span className="text-amber-600 font-medium">متبقي {totalCount - completedCount} قسم</span>
              )}
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isAllCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Master Toolbar (Button to change all sections) */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-700">قائمة أقسام التصنيع:</div>
          <div className="flex items-center gap-2">
            {isAllCompleted ? (
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
                title="إرجاع كافة الأقسام إلى حالة قيد التصنيع"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إرجاع جميع الأقسام لقيد التصنيع</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                title="تعليم كافة الأقسام كمكتملة وتحديث الحالة إلى جاهز"
              >
                <CheckCheck className="w-4 h-4" />
                <span>اكتمال جميع الأقسام دفعة واحدة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleToggleAll(!isAllCompleted)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="تبديل الكل"
            >
              {isAllCompleted ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>
          </div>
        </div>

        {/* Sections List */}
        <div className="p-4 max-h-[50vh] overflow-y-auto space-y-3 bg-slate-50/50">
          {sections.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              لم يتم العثور على أقسام تصنيع مسجلة. يرجى مراجعة إعدادات أنواع الأعمال.
            </div>
          ) : (
            sections.map((sec, idx) => {
              const matCount = sectionMaterialCounts.get(sec.sectionId) || 0;
              const secDurationDays = sec.isCompleted ? calculateDurationDays(startDateRef, sec.completedAt) : null;
              const secDurationText = secDurationDays !== null ? formatDurationDaysAr(secDurationDays) : '';
              return (
                <div
                  key={sec.sectionId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    sec.isCompleted
                      ? 'bg-emerald-50/40 border-emerald-200 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* Section Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{sec.sectionName}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            matCount > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {matCount > 0 ? `${matCount} مواد مسجلة` : 'بدون مواد'}
                          </span>
                          {sec.isCompleted && secDurationText && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                              مدة التنفيذ: {secDurationText}
                            </span>
                          )}
                        </div>
                        {sec.isCompleted && sec.completedAt && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            <span>تاريخ الإنجاز: {formatReadableDateTime(sec.completedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      
                      {/* Date Picker (visible when completed) */}
                      {sec.isCompleted && (
                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200" title="تعديل تاريخ ووقت الاكتمال">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="datetime-local"
                            value={sec.completedAt ? sec.completedAt.slice(0, 16) : ''}
                            onChange={(e) => handleDateChange(sec.sectionId, e.target.value)}
                            className="text-xs bg-transparent text-slate-700 font-mono outline-none cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Status Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleSection(sec.sectionId)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          sec.isCompleted
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {sec.isCompleted ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>مكتمل</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>قيد التصنيع</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {isAllCompleted ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-600" /> سيتم حفظ حالة المنتج كـ "جاهز"
              </span>
            ) : (
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-600" /> سيتم حفظ حالة المنتج كـ "قيد التصنيع"
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتحديث الحالة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
