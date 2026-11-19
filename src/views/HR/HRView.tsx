import React, { useState, useEffect } from 'react';
import { useHR } from '../../context/HRContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { SubTabNav } from '../../components/ui/SubTabNav';
import {
  Clock, Users, Calendar, DollarSign, FileText, Settings, ArrowRightLeft, TrendingUp,
  RefreshCw, CheckCircle2, AlertCircle, X, ShieldCheck
} from 'lucide-react';

import { AttendanceView } from './AttendanceView';
import { OvertimeView } from './OvertimeView';
import { EmployeesView } from './EmployeesView';
import { ShiftsView } from './ShiftsView';
import { TransactionsView } from './TransactionsView';
import { PayrollView } from './PayrollView';
import { MonthlyReportView } from './MonthlyReportView';
import { ZKSettingsView } from './ZKSettingsView';

interface HRViewProps {
  refreshKey?: number;
}

export const HRView: React.FC<HRViewProps> = ({ refreshKey }) => {
  const {
    employees,
    shifts,
    attendanceLogs,
    payrollRecords,
    overtimeRecords,
    triggerSync,
    isSyncing,
    syncStats
  } = useHR();

  const [activeTab, setActiveTab] = useLocalStorage<string>('shams_hr_tab', 'attendance');
  const [showStatusBanner, setShowStatusBanner] = useState(true);
  const [autoSyncState, setAutoSyncState] = useState<{
    status: 'idle' | 'syncing' | 'success' | 'error';
    message?: string;
    count?: number;
    time?: string;
  }>({ status: 'idle' });

  // دالة تنفيذ سحب البصمات
  const executeSync = async () => {
    setAutoSyncState({ status: 'syncing' });
    setShowStatusBanner(true);
    try {
      const res = await triggerSync({ logsOnly: true });
      if (res.success) {
        const count = res.insertedLogsCount ?? 0;
        const timeStr = new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setAutoSyncState({
          status: 'success',
          count,
          time: timeStr,
          message: count > 0
            ? `تم سحب وتحديث البصمات آلياً بنجاح (تم استيراد ${count} حركة جديدة)`
            : 'تم التحقق من جهاز البصمة آلياً (جميع الحركات محدثة ولا توجد حركات جديدة)'
        });
      } else {
        if (res.inProgress) {
          return;
        }
        setAutoSyncState({
          status: 'error',
          message: res.error || 'تعذر الاتصال بجهاز البصمة'
        });
      }
    } catch (err: any) {
      setAutoSyncState({
        status: 'error',
        message: err.message || 'حدث خطأ غير متوقع أثناء سحب البصمات'
      });
    }
  };

  // سحب البصمات آلياً في كل مرة يدخل فيها المستخدم على قسم الموارد البشرية
  useEffect(() => {
    executeSync();
  }, [refreshKey]);

  const tabs = [
    { id: 'attendance', label: 'سجل الحضور اليومي', icon: Clock, count: attendanceLogs.length > 0 ? undefined : 0 },
    { id: 'overtime', label: 'معالجة العمل الإضافي', icon: TrendingUp },
    { id: 'employees', label: 'دليل الموظفين', icon: Users, count: employees.length },
    { id: 'shifts', label: 'جداول العمل والورديات', icon: ArrowRightLeft, count: shifts.length },
    { id: 'transactions', label: 'السلفيات والخصومات', icon: DollarSign },
    { id: 'payroll', label: 'مسير الرواتب الشهري', icon: FileText, count: payrollRecords.length },
    { id: 'reports', label: 'التقارير وبطاقة الحضور', icon: Calendar },
    { id: 'zk_settings', label: 'إعدادات البصمة', icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {/* Auto-Sync Status Notification Banner */}
      {showStatusBanner && autoSyncState.status !== 'idle' && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs font-medium transition-all shadow-xs ${
            autoSyncState.status === 'syncing'
              ? 'bg-blue-50/90 border-blue-200 text-blue-900'
              : autoSyncState.status === 'success'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/90 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {autoSyncState.status === 'syncing' && (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            )}
            {autoSyncState.status === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
            {autoSyncState.status === 'error' && (
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">
                {autoSyncState.status === 'syncing' && 'جاري سحب وتحديث البصمات آلياً من الجهاز...'}
                {autoSyncState.status === 'success' && autoSyncState.message}
                {autoSyncState.status === 'error' && `تنبيه الاتصال بجهاز البصمة: ${autoSyncState.message}`}
              </span>

              {autoSyncState.time && (
                <span className="text-slate-500 font-mono text-[11px] bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/60">
                  آخر سحب: {autoSyncState.time}
                </span>
              )}

              {autoSyncState.status === 'success' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  حركات البصمة فقط (دون المساس بالموظفين)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 mr-3">
            {autoSyncState.status === 'error' && (
              <button
                type="button"
                onClick={() => setActiveTab('zk_settings')}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
              >
                إعدادات البصمة
              </button>
            )}

            <button
              type="button"
              onClick={executeSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-2xs transition-all disabled:opacity-50"
              title="إعادة سحب البصمات يدوياً الآن"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
              <span>{isSyncing ? 'جاري السحب...' : 'سحب الآن'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStatusBanner(false)}
              className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              title="إغلاق هذا الشريط"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub Tab Navigation */}
      <SubTabNav
        tabs={tabs}
        activeTab={activeTab}
        onChange={id => setActiveTab(id)}
        title="قسم الموارد البشرية"
        description="إدارة الحضور والانصراف، جداول العمل، السلفيات، ومسير الرواتب المرتبط بجهاز ZKTeco"
      />

      {/* Tab Contents */}
      {activeTab === 'attendance' && <AttendanceView />}
      {activeTab === 'overtime' && <OvertimeView />}
      {activeTab === 'employees' && <EmployeesView />}
      {activeTab === 'shifts' && <ShiftsView />}
      {activeTab === 'transactions' && <TransactionsView />}
      {activeTab === 'payroll' && <PayrollView />}
      {activeTab === 'reports' && <MonthlyReportView />}
      {activeTab === 'zk_settings' && <ZKSettingsView />}
    </div>
  );
};
