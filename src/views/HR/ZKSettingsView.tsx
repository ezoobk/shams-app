import React, { useState } from 'react';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import {
  Settings, Database, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, DollarSign, Calendar, Save, Check, Wifi, HardDrive, ShieldCheck
} from 'lucide-react';
import { zkTestConnection } from '../../api/client';

export const ZKSettingsView: React.FC = () => {
  const {
    hrSettings,
    setHrSettings,
    triggerSync,
    isSyncing
  } = useHR();
  const { hasPermission } = useAuth();

  const [formSettings, setFormSettings] = useState({
    zkConnectionMode: hrSettings.zkConnectionMode || 'direct',
    zkDeviceIp: hrSettings.zkDeviceIp || '192.168.16.200',
    zkDevicePort: hrSettings.zkDevicePort || 4370,
    ...hrSettings
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Test ZKTeco connection (direct device or file)
  const handleTest = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const mode = formSettings.zkConnectionMode || 'direct';
      const res = await zkTestConnection({
        mode,
        ip: formSettings.zkDeviceIp || '192.168.16.200',
        port: formSettings.zkDevicePort || 4370,
        path: formSettings.zktecoDbPath
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTestingConnection(false);
    }
  };

  // Full historic punch logs sync
  const handleFullSync = async () => {
    if (!window.confirm('هل تريد إجراء مزامنة لجميع سجلات البصمات من الجهاز؟ لن يتم المساس ببيانات الموظفين.')) return;
    const res = await triggerSync({ fullSync: true, logsOnly: true });
    if (res.success) {
      alert(`تمت مزامنة البصمات بنجاح! تم استيراد (${res.insertedLogsCount || 0}) حركة بصمة جديدة.`);
    } else {
      alert(`فشلت المزامنة: ${res.error}`);
    }
  };

  // Match active employees with physical device
  const handleMatchActive = async () => {
    const ip = formSettings.zkDeviceIp || '192.168.16.200';
    if (!window.confirm(
      `هل تريد مطابقة الموظفين مع جهاز البصمة (${ip})؟\n\n` +
      `سيتم استيراد الموظفين النشطين في الجهاز فقط، وحذف الموظفين القدامى غير المسجلين في الجهاز من المنظومة.`
    )) return;

    const res = await triggerSync({ matchActiveOnly: true, purgeMissing: true });
    if (res.success) {
      alert(
        `تمت المطابقة بنجاح!\n` +
        `• الموظفون النشطون في الجهاز: ${res.activeUsersCount || res.totalUsers}\n` +
        `• الموظفون القدامى الذين تم حذفهم: ${res.purgedUsersCount || 0}`
      );
    } else {
      alert(`تعذرت المطابقة: ${res.error}`);
    }
  };

  // Save settings
  const handleSave = async () => {
    await setHrSettings(formSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-blue-600" />
            إعدادات البصمة وقواعد الموارد البشرية
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تهيئة الاتصال المباشر بجهاز البصمة (Ethernet) أو قاعدة بياناته وضبط القواعد العامة
          </p>
        </div>

        {hasPermission('hr', 'edit') && (
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-xs"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'تم الحفظ!' : 'حفظ الإعدادات'}</span>
          </button>
        )}
      </div>

      {/* ── 1. ZKTeco Device Connection Settings ─────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Wifi className="w-5 h-5 text-blue-600" />
            طريقة الربط مع جهاز البصمة ZKTeco
          </div>

          {/* Connection Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFormSettings({ ...formSettings, zkConnectionMode: 'direct' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                formSettings.zkConnectionMode === 'direct'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>مباشر عبر الشبكة (Ethernet IP) - موصى به</span>
            </button>
            <button
              type="button"
              onClick={() => setFormSettings({ ...formSettings, zkConnectionMode: 'file' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                formSettings.zkConnectionMode === 'file'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>ملف محلي (att2000.mdb)</span>
            </button>
          </div>
        </div>

        {/* Direct Network Mode Fields */}
        {formSettings.zkConnectionMode === 'direct' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان جهاز البصمة على الشبكة المحلية (IP Address)
                </label>
                <input
                  type="text"
                  value={formSettings.zkDeviceIp || '192.168.16.200'}
                  onChange={e => setFormSettings({ ...formSettings, zkDeviceIp: e.target.value })}
                  placeholder="192.168.16.200"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  منفذ الاتصال (Port)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formSettings.zkDevicePort || 4370}
                    onChange={e => setFormSettings({ ...formSettings, zkDevicePort: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:bg-white focus:border-blue-500 text-center"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testingConnection}
                    className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 border border-blue-200 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                    <span>فحص الجهاز</span>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              يقوم التطبيق بالاتصال مباشرة بجهاز البصمة عبر منفذ Ethernet دون الحاجة لفتح برامج وسيطة، ويسحب البيانات الحية بدقة وسرعة فائقة.
            </p>
          </div>
        )}

        {/* File Mode Fields */}
        {formSettings.zkConnectionMode === 'file' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مسار ملف قاعدة بيانات البصمة على القرص المحلي أو الشبكة
              </label>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={formSettings.zktecoDbPath}
                  onChange={e => setFormSettings({ ...formSettings, zktecoDbPath: e.target.value })}
                  className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                />
                <button
                  onClick={handleTest}
                  disabled={testingConnection}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>فحص الملف</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                المسار الافتراضي: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">K:\shams\55\ZKTeco\att2000.mdb</code>
              </p>
            </div>
          </div>
        )}

        {/* Test Connection Output Banner */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs ${
            testResult.success
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border-red-200 text-red-900'
          }`}>
            <div className="flex items-center gap-2 font-bold mb-1">
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  الاتصال بجهاز ZKTeco ناجح 100%
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  تعذر الاتصال بجهاز البصمة
                </>
              )}
            </div>
            {testResult.success ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-emerald-200/60 font-mono">
                {testResult.productCode && <div>موديل الجهاز: <span className="font-bold">{testResult.productCode}</span></div>}
                {testResult.serialNumber && <div>الرقم التسلسلي: <span className="font-bold">{testResult.serialNumber}</span></div>}
                <div>الموظفون المسجلون: <span className="font-bold">{testResult.userCount}</span></div>
                <div>حركات البصمة: <span className="font-bold">{testResult.logCount}</span></div>
              </div>
            ) : (
              <p className="mt-1">{testResult.error}</p>
            )}
          </div>
        )}

        {/* Sync & Matching Controls */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-800">مطابقة الموظفين النشطين مع الجهاز الفعلي</div>
            <div className="text-[11px] text-slate-500">
              الاحتفاظ بالموظفين المسجلين في جهاز البصمة فقط، وتنظيف الموظفين القدامى المحذوفين
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMatchActive}
              disabled={isSyncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>مطابقة الموظفين النشطين</span>
            </button>

            <button
              onClick={handleFullSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>سحب البصمات الآن</span>
            </button>
          </div>
        </div>

        <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            المزامنة التلقائية المجدولة:
          </div>
          <p className="text-[11px] text-blue-800">
            يقوم النظام بمزامنة الحركات آلياً في الخلفية مباشرة من عنوان الجهاز <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-bold">192.168.16.200</code> عند بداية الدوام ونهايته لتسجيل أوقات الحضور والانصراف اللحظية.
          </p>
        </div>
      </div>

      {/* ── 2. General Overtime Calculation Rules ─────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-2 text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          <DollarSign className="w-5 h-5 text-purple-600" />
          القاعدة العامة لاحتساب ساعات العمل الإضافي (Overtime)
        </div>

        <p className="text-xs text-slate-500">
          تُطبق هذه القاعدة العامة تلقائياً على جميع الموظفين الذين تم ضبط احتساب الإضافي لديهم على "حسب القاعدة العامة".
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            formSettings.generalOvertimeMode === 'percent'
              ? 'bg-purple-50/60 border-purple-300 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="genOtMode"
              checked={formSettings.generalOvertimeMode === 'percent'}
              onChange={() => setFormSettings({ ...formSettings, generalOvertimeMode: 'percent' })}
              className="mt-1"
            />
            <div className="space-y-2 flex-1">
              <div className="font-bold text-slate-900 text-sm">نسبة مئوية مضافة من أجر ساعة الموظف</div>
              <div className="text-xs text-slate-500">تُحسب قيمة ساعة الإضافي كنسبة من قيمة الساعة العادية للموظف (مثلاً 1.25x = 125%).</div>
              {formSettings.generalOvertimeMode === 'percent' && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    value={formSettings.generalOvertimePercent}
                    onChange={e => setFormSettings({ ...formSettings, generalOvertimePercent: Number(e.target.value) })}
                    className="w-24 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-center"
                  />
                  <span className="text-xs font-bold text-purple-800">% (مثال: 125% أو 150%)</span>
                </div>
              )}
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            formSettings.generalOvertimeMode === 'fixed'
              ? 'bg-purple-50/60 border-purple-300 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="genOtMode"
              checked={formSettings.generalOvertimeMode === 'fixed'}
              onChange={() => setFormSettings({ ...formSettings, generalOvertimeMode: 'fixed' })}
              className="mt-1"
            />
            <div className="space-y-2 flex-1">
              <div className="font-bold text-slate-900 text-sm">قيمة نقدية ثابتة مقابل كل ساعة</div>
              <div className="text-xs text-slate-500">مبلغ مالي ثابت يُصرف للموظف عن كل ساعة عمل إضافية بغض النظر عن راتبه الأساسي.</div>
              {formSettings.generalOvertimeMode === 'fixed' && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    value={formSettings.generalOvertimeFixedRate}
                    onChange={e => setFormSettings({ ...formSettings, generalOvertimeFixedRate: Number(e.target.value) })}
                    className="w-24 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-center"
                  />
                  <span className="text-xs font-bold text-purple-800">دينار ليبي / ساعة</span>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* ── Overtime General Limits: Min Threshold & Max Ceiling ── */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>القاعدة العامة للحدين الأدنى والأعلى لاحتساب الإضافي</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تحدد هذه الضوابط متى يبدأ احتساب الوقت الإضافي وما هو أقصى سقف مسموح به لمنع تسجيل أوقات طفيفة أو مفرطة
            </p>
          </div>

          {/* Scope Selector: Per Period vs Daily Total */}
          <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-2.5">
            <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
              <span>نطاق تطبيق الحد الأدنى في الورديات المنقسمة أو المتعددة:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                (formSettings.overtimeThresholdScope || 'per_period') === 'per_period'
                  ? 'bg-white border-purple-400 shadow-xs'
                  : 'bg-white/60 border-slate-200 hover:bg-white'
              }`}>
                <input
                  type="radio"
                  name="otScope"
                  checked={(formSettings.overtimeThresholdScope || 'per_period') === 'per_period'}
                  onChange={() => setFormSettings({ ...formSettings, overtimeThresholdScope: 'per_period' })}
                  className="mt-0.5 text-purple-600"
                />
                <div className="space-y-1">
                  <div className="font-bold text-xs text-slate-900">
                    لكل وردية / فترة مستقلة (موصى به)
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    يُشترط بلوغ الحد الأدنى في كل فترة على حدة؛ ولا تُجمع الدقائق العرضية بين الصباح والمساء (مثال: 20 دقيقة صباحاً و 20 دقيقة مساءً لا تُعتمد كإضافي إذا كان الحد الأدنى 30 دقيقة).
                  </div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                formSettings.overtimeThresholdScope === 'daily_total'
                  ? 'bg-white border-purple-400 shadow-xs'
                  : 'bg-white/60 border-slate-200 hover:bg-white'
              }`}>
                <input
                  type="radio"
                  name="otScope"
                  checked={formSettings.overtimeThresholdScope === 'daily_total'}
                  onChange={() => setFormSettings({ ...formSettings, overtimeThresholdScope: 'daily_total' })}
                  className="mt-0.5 text-purple-600"
                />
                <div className="space-y-1">
                  <div className="font-bold text-xs text-slate-900">
                    على إجمالي اليوم ككل
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    يتم تجميع كافة دقائق الإضافي من الصباح والمساء معاً أولاً، ثم مقارنة المجموع الكلي بالحد الأدنى.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Minimum Overtime Threshold */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                الحد الأدنى لاحتساب الإضافي (بالدقائق)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={formSettings.minOvertimeMinutes !== undefined ? formSettings.minOvertimeMinutes : 30}
                  onChange={e => setFormSettings({ ...formSettings, minOvertimeMinutes: Math.max(0, Number(e.target.value)) })}
                  className="w-24 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-center outline-none focus:border-purple-500"
                />
                <span className="text-xs font-bold text-slate-600">دقيقة</span>
              </div>
              <p className="text-[11px] text-slate-400">
                إذا كان الإضافي أقل من هذا الحد (مثلاً أقل من 30 دقيقة) يُهمل تماماً ولا يُحتسب.
              </p>
            </div>

            {/* Maximum Daily Overtime */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                الحد الأعلى للإضافي اليومي (بالساعات)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formSettings.maxDailyOvertimeHours !== undefined ? formSettings.maxDailyOvertimeHours : 4}
                  onChange={e => setFormSettings({ ...formSettings, maxDailyOvertimeHours: Math.max(0, Number(e.target.value)) })}
                  className="w-24 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-center outline-none focus:border-purple-500"
                />
                <span className="text-xs font-bold text-slate-600">ساعة / يوم</span>
              </div>
              <p className="text-[11px] text-slate-400">
                أقصى حد لساعات الإضافي المعتمدة في اليوم الواحد (0 لعدم وجود حد أعلى).
              </p>
            </div>

            {/* Maximum Monthly Overtime */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                الحد الأعلى للإضافي الشهري (اختياري)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formSettings.maxMonthlyOvertimeHours !== undefined ? formSettings.maxMonthlyOvertimeHours : 60}
                  onChange={e => setFormSettings({ ...formSettings, maxMonthlyOvertimeHours: Math.max(0, Number(e.target.value)) })}
                  className="w-24 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-center outline-none focus:border-purple-500"
                />
                <span className="text-xs font-bold text-slate-600">ساعة / شهر</span>
              </div>
              <p className="text-[11px] text-slate-400">
                سقف إجمالي ساعات الإضافي لشهر كامل (0 لعدم التقييد الشهري).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Missing Punch Delay Penalty Rule (خصم عدم وجود البصمة) ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            قاعدة خصم عدم وجود البصمة (البصمة المفردة أو الناقصة)
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-bold text-slate-600">
              {formSettings.missingPunchPenaltyEnabled !== false ? 'مفعلة' : 'معطلة'}
            </span>
            <input
              type="checkbox"
              checked={formSettings.missingPunchPenaltyEnabled !== false}
              onChange={e => setFormSettings({ ...formSettings, missingPunchPenaltyEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
          </label>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          عند حضور الموظف وعدم تسجيله لبصمة الدخول أو الانصراف (تسجيل بصمة مفردة أو نقص بصمة وردية)، يُحتسب خصم تأخير بالساعات يحدده صاحب العمل تلقائياً ويُخصم من راتبه في تقرير المرتبات. وفي حال قام المسؤول بإجراء <strong>"تعبئة سريعة"</strong> للبصمة أو تسويتها يدوياً، يُلغى الخصم فوراً.
        </p>

        {formSettings.missingPunchPenaltyEnabled !== false ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Penalty Delay Hours */}
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-amber-950">
                  ساعات التأخير المحتسبة عند عدم وجود البصمة
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formSettings.missingPunchPenaltyHours !== undefined ? formSettings.missingPunchPenaltyHours : 3}
                    onChange={e => setFormSettings({ ...formSettings, missingPunchPenaltyHours: Math.max(0, Number(e.target.value)) })}
                    className="w-24 p-2 bg-white border border-amber-300 rounded-lg text-sm font-bold font-mono text-center outline-none focus:border-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-900">ساعات تأخير (الافتراضي: 3 ساعات)</span>
                </div>
                <p className="text-[11px] text-amber-700/80 leading-relaxed">
                  مثال: عدم وجود بصمة خروج يحسب على الموظف تأخير 3 ساعات ويُخصم ما يقابلها من الراتب.
                </p>
              </div>

              {/* Apply Mode: Per Punch vs Per Day */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  آلية تطبيق الخصم
                </label>
                <div className="space-y-2 pt-1">
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                    (formSettings.missingPunchApplyMode || 'per_punch') === 'per_punch'
                      ? 'bg-white border-amber-400 shadow-xs'
                      : 'border-transparent hover:bg-white/60'
                  }`}>
                    <input
                      type="radio"
                      name="missingPunchApplyMode"
                      checked={(formSettings.missingPunchApplyMode || 'per_punch') === 'per_punch'}
                      onChange={() => setFormSettings({ ...formSettings, missingPunchApplyMode: 'per_punch' })}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">لكل بصمة مفقودة (موصى به)</div>
                      <div className="text-[11px] text-slate-500">
                        إذا نسي بصمة الخروج يُخصم 3 ساعات، وإذا نسي بصمتين في الوردية المنقسمة يُخصم 6 ساعات.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                    formSettings.missingPunchApplyMode === 'per_day'
                      ? 'bg-white border-amber-400 shadow-xs'
                      : 'border-transparent hover:bg-white/60'
                  }`}>
                    <input
                      type="radio"
                      name="missingPunchApplyMode"
                      checked={formSettings.missingPunchApplyMode === 'per_day'}
                      onChange={() => setFormSettings({ ...formSettings, missingPunchApplyMode: 'per_day' })}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">سقف ثابت مرة واحدة في اليوم</div>
                      <div className="text-[11px] text-slate-500">
                        يُطبق الخصم مرة واحدة فقط باليوم مهما تعددت البصمات المفقودة في الورديات المتعددة.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Split shift break punch option */}
            <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.missingPunchIncludeBreakPunches || false}
                onChange={e => setFormSettings({ ...formSettings, missingPunchIncludeBreakPunches: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600"
              />
              <div>
                <span className="text-xs font-bold text-slate-800">
                  تطبيق الخصم على بصمات استراحة الغداء في الورديات المنقسمة
                </span>
                <p className="text-[11px] text-slate-500">
                  افتراضياً غير مفعل؛ يتم خصم مدة الاستراحة تلقائياً من ساعات العمل دون معاقبة الموظف إذا التزم ببصمتي أول النهار وآخره.
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            تم تعطيل قاعدة خصم البصمة الناقصة. سيتم احتساب دوام نصف يوم افتراضي للبصمات المفردة دون خصم ساعات تأخير إضافية.
          </div>
        )}
      </div>

      {/* ── 4. Monthly Work Hours & Days Standards ─────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          المعايير العامة لاحتساب أيام وساعات الشهر
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عدد أيام العمل المحسوبة في الشهر (لقسمة الراتب الشهري)
            </label>
            <input
              type="number"
              value={formSettings.workDaysPerMonth}
              onChange={e => setFormSettings({ ...formSettings, workDaysPerMonth: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">المعيار الشائع: 26 يوماً (مع استثناء الجمعة) أو 30 يوماً</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ساعات العمل اليومية المعيارية
            </label>
            <input
              type="number"
              value={formSettings.standardHoursPerDay}
              onChange={e => setFormSettings({ ...formSettings, standardHoursPerDay: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">تستخدم لحساب قيمة أجر الساعة للموظف ذو الراتب الشهري أو اليومية</p>
          </div>
        </div>
      </div>

      {/* Bottom Save Action */}
      {hasPermission('hr', 'edit') && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'تم حفظ كافة الإعدادات بنجاح!' : 'حفظ الإعدادات والقواعد'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
