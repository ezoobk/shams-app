import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings } from 'lucide-react';
import shamsLogo from '../../assets/shamsLogo.png';
import { useSettings } from '../../context/SettingsContext';
import { useDatabaseObject } from '../../hooks/useDatabaseObject';

export const SettingsView = () => {
  const { appSettings, setAppSettings } = useSettings();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings', 'manage');
  const [localCounters, setLocalCounters] = useDatabaseObject<any>('shams_idCounters', { inv: 1, wo: 1, sn: 1, ref: 1 });
  
  const handleCounterChange = (key: string, val: number) => {
    const newCounters = { ...localCounters, [key]: val };
    setLocalCounters(newCounters);
  };

  const [autoStart, setAutoStart] = useState(() => (window as any).electronAPI ? (window as any).electronAPI.getAutostart() : false);
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
    <div className="max-w-4xl mx-auto pb-20">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> إعدادات الشركة والطباعة</h2>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الشركة (عربي)</label>
            <textarea className="w-full p-2 border border-slate-300 rounded outline-none h-20 leading-snug whitespace-pre-wrap" value={appSettings.companyNameAr} onChange={e => setAppSettings({ ...appSettings, companyNameAr: e.target.value })} placeholder="مثال: شمس للأعمال المعدنية&#10;والبيوت المتنقلة" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الشركة (إنجليزي)</label>
            <textarea className="w-full p-2 border border-slate-300 rounded outline-none h-20 text-left dir-ltr leading-snug whitespace-pre-wrap" value={appSettings.companyNameEn} onChange={e => setAppSettings({ ...appSettings, companyNameEn: e.target.value })} placeholder="Example: Shams Co.&#10;For Metal Fabrication" />
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
          <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
            <h3 className="font-bold text-slate-700 mb-3 text-lg">إعدادات النظام (System Settings)</h3>
            
            <div className="mt-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 mb-2">إعدادات العدادات والأرقام التسلسلية (Counters)</div>
              <div className="text-sm text-slate-500 mb-4">يمكنك تعديل نقطة البداية للأرقام التسلسلية (الرقم المدخل سيكون هو الرقم القادم).</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الرقم التسلسلي القادم (SN)</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono font-bold text-lg text-blue-700" value={localCounters?.sn || 1} onChange={e => handleCounterChange('sn', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رقم الفاتورة القادم</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono" value={localCounters?.ref || 1} onChange={e => handleCounterChange('ref', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رقم أمر العمل القادم</label>
                  <input disabled={!canManage} type="number" className="w-full p-2 border border-slate-300 rounded outline-none font-mono" value={localCounters?.wo || 1} onChange={e => handleCounterChange('wo', parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-4 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors mt-4">
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={autoStart}
                onChange={(e) => {
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
          </div>
        </div>
      </div>
    </div>
  );
};
