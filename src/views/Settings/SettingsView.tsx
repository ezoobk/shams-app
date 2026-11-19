import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Power, Clock, Database, Printer } from 'lucide-react';
import shamsLogo from '../../assets/shamsLogo.png';
import { useSettings } from '../../context/SettingsContext';
import { useDatabaseObject } from '../../hooks/useDatabaseObject';
import { SubTabNav } from '../../components/ui/SubTabNav';
import { BackupManagerSection } from './BackupManagerSection';

export const SettingsView = () => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'backups'>('general');
  const { appSettings, setAppSettings, idCounters: localCounters, setIdCounters: setLocalCounters } = useSettings();
  const { hasPermission, sessionTimeoutHours, setSessionTimeoutHours } = useAuth();
  const canManage = hasPermission('settings', 'manage');
  
  const handleCounterChange = (key: string, val: number) => {
    const newCounters = { ...localCounters, [key]: val };
    setLocalCounters(newCounters);
  };

  const [autoStart, setAutoStart] = useState(() => (window as any).electronAPI ? (window as any).electronAPI.getAutostart() : false);
  const [runInBackground, setRunInBackground] = useState(() => (window as any).electronAPI?.getRunInBackground ? (window as any).electronAPI.getRunInBackground() : true);
  const [dbPath, setDbPath] = useState(() => (window as any).electronAPI ? (window as any).electronAPI.getDbPath() : 'الوضع المحلي');

  const handleChangeDbPath = () => {
    if ((window as any).electronAPI) {
      const newPath = (window as any).electronAPI.changeDbPath();
      if (newPath) {
        setDbPath(newPath);
        alert('تم تغيير مسار قاعدة البيانات بنجاح! سيتم إعادة تحميل التطبيق الآن.');
        window.location.reload();
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAppSettings({ ...appSettings, logoBase64: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <SubTabNav
        tabs={[
          { id: 'general', label: 'إعدادات الشركة والنظام', icon: Settings },
          { id: 'backups', label: 'النسخ الاحتياطي والأمان', icon: Database },
        ]}
        activeTab={activeSubTab}
        onChange={(t) => setActiveSubTab(t as any)}
        className="mb-6"
      />

      {activeSubTab === 'backups' ? (
        <BackupManagerSection />
      ) : (
        <>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> إعدادات الشركة والطباعة</h2>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الشركة (عربي)</label>
            <textarea disabled={!canManage} className="w-full p-2 border border-slate-300 rounded outline-none h-20 leading-snug whitespace-pre-wrap disabled:bg-slate-50 disabled:text-slate-600" value={appSettings.companyNameAr} onChange={e => setAppSettings({ ...appSettings, companyNameAr: e.target.value })} placeholder="مثال: شمس للأعمال المعدنية&#10;والبيوت المتنقلة" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الشركة (إنجليزي)</label>
            <textarea disabled={!canManage} className="w-full p-2 border border-slate-300 rounded outline-none h-20 text-left dir-ltr leading-snug whitespace-pre-wrap disabled:bg-slate-50 disabled:text-slate-600" value={appSettings.companyNameEn} onChange={e => setAppSettings({ ...appSettings, companyNameEn: e.target.value })} placeholder="Example: Shams Co.&#10;For Metal Fabrication" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label>
            <input disabled={!canManage} type="text" className="w-full p-2 border border-slate-300 rounded outline-none" value={appSettings.address} onChange={e => setAppSettings({ ...appSettings, address: e.target.value })} placeholder="مثال: الزاوية - ليبيا" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">السجل التجاري / الضريبي</label>
            <input disabled={!canManage} type="text" className="w-full p-2 border border-slate-300 rounded outline-none" value={appSettings.cr} onChange={e => setAppSettings({ ...appSettings, cr: e.target.value })} placeholder="مثال: السجل التجاري: 20181" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">أرقام الهواتف</label>
            <input disabled={!canManage} type="text" className="w-full p-2 border border-slate-300 rounded outline-none dir-ltr text-left" value={appSettings.phones} onChange={e => setAppSettings({ ...appSettings, phones: e.target.value })} placeholder="091XXXXXXX - 092XXXXXXX" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
            <input disabled={!canManage} type="text" className="w-full p-2 border border-slate-300 rounded outline-none dir-ltr text-left" value={appSettings.email} onChange={e => setAppSettings({ ...appSettings, email: e.target.value })} placeholder="Email: info@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الموقع الإلكتروني</label>
            <input disabled={!canManage} type="text" className="w-full p-2 border border-slate-300 rounded outline-none dir-ltr text-left" value={appSettings.website} onChange={e => setAppSettings({ ...appSettings, website: e.target.value })} placeholder="Web: company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">شعار الشركة (Logo)</label>
            <input disabled={!canManage} type="file" accept="image/*" onChange={handleLogoUpload} className="w-full p-1 border border-slate-300 rounded outline-none text-sm bg-slate-50" />
            {(appSettings.logoBase64 || shamsLogo) && (
              <div className="mt-3 border border-slate-200 p-3 rounded bg-slate-50 text-center">
                <div className="text-xs text-slate-500 mb-2">معاينة الشعار:</div>
                <img src={appSettings.logoBase64 || shamsLogo} alt="Logo Preview" className="h-20 w-auto object-contain mx-auto" />
                {appSettings.logoBase64 && (
                  <button disabled={!canManage} onClick={() => setAppSettings({ ...appSettings, logoBase64: null })} className="text-xs text-red-500 mt-2 hover:underline font-bold bg-white px-2 py-1 border border-red-200 rounded">إزالة الشعار المخصص واستعادة الافتراضي</button>
                )}
              </div>
            )}
          </div>
          {/* Print Layout & Typography Settings */}
          <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
            <h3 className="font-bold text-slate-800 mb-3 text-lg flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              إعدادات تنسيق المطبوعات والخطوط (Print Layout & Scale)
            </h3>
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  مقياس وحجم خط المطبوعات الافتراضي (Print Scale)
                </label>
                <div className="text-xs text-slate-500 mb-3">
                  يتحكم في مقياس طباعة الفواتير وأوامر النقل والتصنيع ليناسب عدد البنود على صفحة واحدة. الوضع الموصى به (90%) يضمن ظهور حتى 10-12 بنداً مع صندوق الاعتماد والتوقيع والختم في صفحة واحدة دون انقسام.
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { scale: 80, label: '80%', desc: 'مدمج جداً (14-16 بند)' },
                    { scale: 85, label: '85%', desc: 'مدمج (12-14 بند)' },
                    { scale: 90, label: '90% ⭐', desc: 'مضغوط (موصى به - 10-12 بند)' },
                    { scale: 95, label: '95%', desc: 'شبه عادي (8-10 بنود)' },
                    { scale: 100, label: '100%', desc: 'عادي (للمستندات القصيرة)' }
                  ].map(item => (
                    <button
                      key={item.scale}
                      type="button"
                      disabled={!canManage}
                      onClick={() => setAppSettings({ ...appSettings, printScale: item.scale })}
                      className={`p-3 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        (appSettings.printScale || 90) === item.scale
                          ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold shadow-xs ring-2 ring-blue-200'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-base font-black">{item.label}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider for fine tuning */}
              <div className="pt-2 border-t border-slate-200 flex items-center gap-4">
                <span className="text-xs font-bold text-slate-600 shrink-0">ضبط المقياس يدوياً:</span>
                <input
                  type="range"
                  min="75"
                  max="105"
                  step="1"
                  disabled={!canManage}
                  value={appSettings.printScale || 90}
                  onChange={(e) => setAppSettings({ ...appSettings, printScale: parseInt(e.target.value) || 90 })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-sm font-bold text-blue-700 font-mono w-14 text-center">
                  {appSettings.printScale || 90}%
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
            <h3 className="font-bold text-slate-700 mb-3 text-lg">إعدادات النظام (System Settings)</h3>
            
            <div className="mt-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 mb-2">إعدادات العدادات والأرقام التسلسلية (Counters)</div>
              <div className="text-sm text-slate-500 mb-4">يمكنك تعديل نقطة البداية للأرقام التسلسلية (الرقم المدخل سيكون هو الرقم القادم).</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الرقم التسلسلي (SN)</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono font-bold text-lg text-blue-700" value={localCounters?.sn || 1} onChange={e => handleCounterChange('sn', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">فاتورة صادر (Ref)</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono font-bold text-lg text-indigo-700" value={localCounters?.ref || 1} onChange={e => handleCounterChange('ref', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">فاتورة مشتريات (PINV)</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono font-bold text-lg text-emerald-700" value={localCounters?.pinv || 1} onChange={e => handleCounterChange('pinv', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">أمر عمل (WO)</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono font-bold text-lg text-amber-700" value={localCounters?.wo || 1} onChange={e => handleCounterChange('wo', parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>

            <label className={`flex items-center gap-3 bg-slate-50 p-4 border border-slate-200 rounded-lg transition-colors mt-4 ${canManage ? 'cursor-pointer hover:bg-slate-100' : 'cursor-not-allowed opacity-75'}`}>
              <input
                disabled={!canManage}
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:cursor-not-allowed"
                checked={autoStart}
                onChange={(e) => {
                  if (!canManage) return;
                  const checked = e.target.checked;
                  setAutoStart(checked);
                  if ((window as any).electronAPI) {
                    (window as any).electronAPI.setAutostart(checked);
                  }
                }}
              />
              <div>
                <div className="font-bold text-slate-800">تشغيل التطبيق تلقائياً عند بدء تشغيل ويندوز (Auto-start)</div>
                <div className="text-sm text-slate-500">سيتم فتح النظام مباشرة عند تشغيل الكمبيوتر لتوفير الوقت.</div>
              </div>
            </label>

            <label className={`flex items-center gap-3 bg-slate-50 p-4 border border-slate-200 rounded-lg transition-colors mt-4 ${canManage ? 'cursor-pointer hover:bg-slate-100' : 'cursor-not-allowed opacity-75'}`}>
              <input
                disabled={!canManage}
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:cursor-not-allowed"
                checked={runInBackground}
                onChange={(e) => {
                  if (!canManage) return;
                  const checked = e.target.checked;
                  setRunInBackground(checked);
                  if ((window as any).electronAPI?.setRunInBackground) {
                    (window as any).electronAPI.setRunInBackground(checked);
                  }
                }}
              />
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <span>الاستمرار في التشغيل في الخلفية عند الإغلاق (Minimize to Tray on Close)</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">موصى به للجهاز الرئيسي</span>
                </div>
                <div className="text-sm text-slate-500">
                  عند إغلاق النافذة، تستمر المنظومة وخادم الشبكة في العمل بالخلفية بشريط المهام (بجانب الساعة) حتى لا ينقطع اتصال الأجهزة الأخرى بالشبكة.
                </div>
              </div>
            </label>

            <div className="mt-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    <span>مهلة الجلسة عند عدم النشاط (Inactivity Session Timeout)</span>
                    <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full">أمان المستخدم</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    يتم تسجيل خروج المستخدم تلقائياً عند ترك النظام دون نشاط أو حركة (حتى وإن تم إغلاق البرنامج وإعادة فتحه لاحقاً).
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    disabled={!canManage}
                    value={sessionTimeoutHours}
                    onChange={(e) => setSessionTimeoutHours(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 shadow-sm disabled:cursor-not-allowed text-sm"
                  >
                    <option value={1}>1 ساعة</option>
                    <option value={2}>ساعتان (2h)</option>
                    <option value={3}>3 ساعات (الافتراضي - موصى به)</option>
                    <option value={4}>4 ساعات</option>
                    <option value={6}>6 ساعات</option>
                    <option value={8}>8 ساعات (يوم عمل كامل)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="font-bold text-slate-800">قاعدة البيانات المشتركة على الشبكة (Shared Database)</div>
                  <div className="text-sm text-slate-500 mb-2">قم باختيار مجلد مشترك على الشبكة لربط عدة أجهزة معاً لتعمل على نفس النظام.</div>
                </div>
                <button disabled={!canManage} onClick={handleChangeDbPath} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 shadow-sm text-sm shrink-0">
                  تغيير مسار قاعدة البيانات
                </button>
              </div>
              <div className="p-2 bg-white border border-slate-300 rounded text-sm text-slate-600 font-mono break-all dir-ltr text-left">
                {dbPath}
              </div>
            </div>

            <div className="mt-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="font-bold text-slate-800">مسار حفظ سجل الصادر (Outbound Log Path)</div>
                  <div className="text-sm text-slate-500 mb-2">قم باختيار المجلد الذي سيتم حفظ الفواتير فيه بصيغة PDF تلقائياً عند اعتمادها.</div>
                </div>
                <button disabled={!canManage} onClick={() => {
                  if ((window as any).electronAPI) {
                    const folder = (window as any).electronAPI.selectFolder('اختر مجلد سجل الصادر');
                    if (folder) setAppSettings({ ...appSettings, outboundLogPath: folder });
                  } else {
                    alert('هذه الميزة متاحة فقط في النسخة المكتبية.');
                  }
                }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 shadow-sm text-sm shrink-0">
                  تغيير المسار
                </button>
              </div>
              <div className="p-2 bg-white border border-slate-300 rounded text-sm text-slate-600 font-mono break-all dir-ltr text-left">
                {appSettings.outboundLogPath || 'لم يتم التحديد'}
              </div>
            </div>

            {(window as any).electronAPI?.quitApp && (
              <div className="mt-4 bg-red-50 p-4 border border-red-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="font-bold text-red-800 flex items-center gap-2">
                    <Power className="w-5 h-5 text-red-600" />
                    <span>إغلاق المنظومة نهائياً والخروج (Quit System)</span>
                  </div>
                  <div className="text-sm text-red-600 mt-1">
                    سيتم إيقاف تشغيل المنظومة والخادم تماماً، وسينقطع اتصال أي أجهزة أخرى تعمل على الشبكة.
                  </div>
                </div>
                <button
                  disabled={!canManage}
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من رغبتك في إيقاف تشغيل المنظومة والخروج نهائياً؟\n\nتنبيه: سيؤدي ذلك لإيقاف خادم الشبكة وانقطاع اتصال الأجهزة الأخرى.')) {
                      (window as any).electronAPI.quitApp();
                    }
                  }}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-red-700 shadow-sm text-sm shrink-0 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Power className="w-4 h-4" />
                  إغلاق المنظومة نهائياً
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
