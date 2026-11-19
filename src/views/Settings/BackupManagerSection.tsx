import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  RotateCcw, 
  Trash2, 
  Folder, 
  FolderOpen, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  HardDrive, 
  ShieldCheck, 
  Plus, 
  Sliders, 
  Save, 
  FileCheck,
  Cloud,
  Layers,
  Check,
  X,
  ExternalLink,
  Usb,
  Network,
  UploadCloud,
  Key,
  FolderSync
} from 'lucide-react';
import { 
  fetchBackupsList, 
  createNewBackup, 
  restoreBackupFile, 
  deleteBackupFile, 
  openBackupFolder, 
  exportBackupFile, 
  saveBackupConfig, 
  pickBackupFolder,
  testBackupDestination,
  testGoogleDriveConfig,
  detectGoogleDriveFolders,
  type BackupItem, 
  type BackupConfig, 
  type BackupDestination,
  type GoogleDriveCloudConfig,
  isElectron 
} from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { logAudit } from '../../context/AuditLogContext';

export const BackupManagerSection: React.FC = () => {
  const { hasPermission, currentUser } = useAuth();
  const canManage = hasPermission('settings', 'manage');

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupFolder, setBackupFolder] = useState<string>('');
  const [config, setConfig] = useState<BackupConfig>({
    autoBackupEnabled: true,
    time1: '12:00',
    time2: '18:00',
    maxBackupsToKeep: 60,
    destinations: [],
    googleDriveCloud: {
      enabled: false,
      folderId: '',
      serviceAccountEmail: '',
      serviceAccountKey: ''
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showDestinationModal, setShowDestinationModal] = useState<boolean>(false);
  const [showGDriveModal, setShowGDriveModal] = useState<boolean>(false);

  // Destination Form State
  const [editingDest, setEditingDest] = useState<Partial<BackupDestination>>({
    id: '',
    name: '',
    path: '',
    type: 'local',
    enabled: true
  });
  const [testingDestPath, setTestingDestPath] = useState<string | null>(null);
  const [destTestResult, setDestTestResult] = useState<{ success: boolean; text: string } | null>(null);

  // Google Drive Cloud Form State
  const [gDriveConfig, setGDriveConfig] = useState<GoogleDriveCloudConfig>({
    enabled: false,
    folderId: '',
    serviceAccountEmail: '',
    serviceAccountKey: ''
  });
  const [isTestingGDrive, setIsTestingGDrive] = useState<boolean>(false);
  const [gDriveTestResult, setGDriveTestResult] = useState<{ success: boolean; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchBackupsList();
      if (res && res.success) {
        const rawData = res.data;
        const items = Array.isArray(rawData?.data) 
          ? rawData.data 
          : (Array.isArray(rawData) ? rawData : []);
        setBackups(items);

        const folder = rawData?.backupFolder || (res as any).backupFolder || '';
        setBackupFolder(folder);

        const cfg = rawData?.config || (res as any).config;
        if (cfg) {
          setConfig(cfg);
          if (cfg.googleDriveCloud) {
            setGDriveConfig(cfg.googleDriveCloud);
          }
        }
      }
    } catch (e: any) {
      console.error('Error fetching backups:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  // 1. إنشاء نسخة احتياطية يدوية وحفظها في كل المسارات
  const handleCreateBackup = async () => {
    if (!canManage) return;
    setIsCreating(true);
    try {
      const res = await createNewBackup('manual');
      const item = res.data || (res as any);
      if (res.success && (item?.fileName || item?.id)) {
        let msg = `تم إنشاء النسخة الاحتياطية بنجاح (${item.sizeFormatted || ''})`;
        if (item.destinationsResults && item.destinationsResults.length > 1) {
          const succCount = item.destinationsResults.filter((d: any) => d.status === 'success').length;
          msg += ` وتم تكرارها في (${succCount} مسارات).`;
        }
        if (item.googleDriveUploadResult) {
          if (item.googleDriveUploadResult.success) {
            msg += ' وتم رفعها بنجاح إلى Google Drive.';
          } else {
            msg += ` (تنبيه Google Drive: ${item.googleDriveUploadResult.error || 'فشل الرفع'})`;
          }
        }
        showNotification('success', msg);
        logAudit({
          actionType: 'create',
          entityType: 'النسخ الاحتياطي',
          entityId: item.fileName,
          title: `إنشاء نسخة احتياطية: ${item.fileName}`,
          details: `الحجم: ${item.sizeFormatted || '--'} | عدد المسارات: ${(config.destinations || []).filter(d => d.enabled).length}`
        });
        await loadData();
      } else {
        showNotification('error', res.error || 'فشل إنشاء النسخة الاحتياطية.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية.');
    } finally {
      setIsCreating(false);
    }
  };

  // 2. استعادة نسخة احتياطية
  const handleRestore = async (backup: BackupItem) => {
    if (!canManage) return;
    const confirm1 = window.confirm(
      `⚠️ تحذير أمني هام:\n\nأنت على وشك استعادة قاعدة البيانات من النسخة:\n${backup.fileName}\nبتاريخ: ${new Date(backup.createdAt).toLocaleString('ar-LY')}\n\nسيتم استبدال البيانات الحالية بالكامل ببيانات هذه النسخة.\n(سيقوم النظام تلقائياً بحفظ نسخة أمان من قاعدة البيانات الحالية قبل الاستبدال).\n\nهل تريد المتابعة بالتأكيد؟`
    );
    if (!confirm1) return;

    setIsRestoring(backup.fileName);
    try {
      const res = await restoreBackupFile(backup.fileName);
      if (res.success) {
        showNotification('success', 'تمت استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة الآن...');
        logAudit({
          actionType: 'edit',
          entityType: 'النسخ الاحتياطي',
          entityId: backup.fileName,
          title: `استعادة قاعدة البيانات من نسخة احتياطية: ${backup.fileName}`,
          details: `تاريخ النسخة: ${new Date(backup.createdAt).toLocaleString('ar-LY')} | الحجم: ${backup.sizeFormatted}`
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showNotification('error', res.error || 'فشلت عملية استعادة النسخة الاحتياطية.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'حدث خطأ أثناء الاستعادة.');
    } finally {
      setIsRestoring(null);
    }
  };

  // 3. حذف نسخة احتياطية
  const handleDelete = async (fileName: string) => {
    if (!canManage) return;
    const confirmed = window.confirm(`هل أنت متأكد من حذف ملف النسخة الاحتياطية:\n${fileName}؟`);
    if (!confirmed) return;

    try {
      const res = await deleteBackupFile(fileName);
      if (res.success) {
        showNotification('success', 'تم حذف ملف النسخة الاحتياطية بنجاح.');
        logAudit({
          actionType: 'delete',
          entityType: 'النسخ الاحتياطي',
          entityId: fileName,
          title: `حذف نسخة احتياطية: ${fileName}`,
          details: `تم الحذف بواسطة: ${currentUser?.displayName || 'المدير'}`
        });
        await loadData();
      } else {
        showNotification('error', res.error || 'فشل حذف الملف.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'حدث خطأ أثناء الحذف.');
    }
  };

  // 4. تصدير / حفظ الملف باسم
  const handleExport = async (fileName: string) => {
    try {
      const res = await exportBackupFile(fileName);
      if (res.success) {
        showNotification('success', res.filePath ? `تم تصدير النسخة بنجاح إلى: ${res.filePath}` : `بدأ تنزيل ملف النسخة الاحتياطية (${fileName}) بنجاح.`);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'حدث خطأ أثناء التصدير.');
    }
  };

  // 5. فتح المجلد
  const handleOpenFolder = async (folderToOpen?: string) => {
    try {
      const res = await openBackupFolder();
      if (!res.success && res.error) {
        showNotification('error', res.error);
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // 6. إدارة المسارات المتعددة (Destinations)
  const handleToggleDestination = async (destId: string, currentEnabled: boolean) => {
    const updated = (config.destinations || []).map(d => 
      d.id === destId ? { ...d, enabled: !currentEnabled } : d
    );
    const newCfg = { ...config, destinations: updated };
    setConfig(newCfg);
    await saveBackupConfig({ destinations: updated });
  };

  const handleOpenAddDestination = () => {
    setEditingDest({
      id: `dest-${Date.now()}`,
      name: '',
      path: '',
      type: 'local',
      enabled: true
    });
    setDestTestResult(null);
    setShowDestinationModal(true);
  };

  const handlePickFolder = async () => {
    const res = await pickBackupFolder('اختر مجلد حفظ النسخ الاحتياطية');
    if (res.success && res.data?.folderPath) {
      setEditingDest(prev => ({
        ...prev,
        path: res.data!.folderPath,
        name: prev.name || ('نسخ احتياطي: ' + res.data!.folderPath.split(/[\\/]/).filter(Boolean).pop())
      }));
    }
  };

  const handleTestDestination = async (folderPathToTest: string) => {
    if (!folderPathToTest) return;
    setTestingDestPath(folderPathToTest);
    setDestTestResult(null);
    try {
      const res = await testBackupDestination(folderPathToTest);
      if (res.success && (res.data?.accessible || (res as any).accessible)) {
        setDestTestResult({ success: true, text: 'المسار متاح وقابل للكتابة بنجاح!' });
      } else {
        setDestTestResult({ success: false, text: res.error || 'المسار غير متاح أو لا توجد صلاحيات كتابة.' });
      }
    } catch (e: any) {
      setDestTestResult({ success: false, text: e.message || 'فشل فحص المسار.' });
    } finally {
      setTestingDestPath(null);
    }
  };

  const handleSaveDestination = async () => {
    if (!editingDest.name || !editingDest.path) {
      alert('الرجاء إدخال اسم المسار ومسار المجلد.');
      return;
    }
    const current = config.destinations || [];
    const exists = current.some(d => d.id === editingDest.id);
    let updated: BackupDestination[];
    if (exists) {
      updated = current.map(d => d.id === editingDest.id ? (editingDest as BackupDestination) : d);
    } else {
      updated = [...current, editingDest as BackupDestination];
    }

    const newCfg = { ...config, destinations: updated };
    setConfig(newCfg);
    setShowDestinationModal(false);
    await saveBackupConfig({ destinations: updated });
    showNotification('success', `تم حفظ المسار [${editingDest.name}] بنجاح.`);
  };

  const handleDeleteDestination = async (destId: string, destName: string) => {
    if (!window.confirm(`هل أنت متأكد من إزالة المسار:\n[${destName}] من مسارات الحفظ؟`)) return;
    const updated = (config.destinations || []).filter(d => d.id !== destId);
    const newCfg = { ...config, destinations: updated };
    setConfig(newCfg);
    await saveBackupConfig({ destinations: updated });
    showNotification('success', `تمت إزالة المسار [${destName}].`);
  };

  // الكشف التلقائي عن مجلدات Google Drive على الجهاز
  const handleDetectGoogleDrive = async () => {
    try {
      const res = await detectGoogleDriveFolders();
      const detected = res.data || [];
      if (detected.length > 0) {
        const picked = detected[0];
        setEditingDest({
          id: `dest-gdrive-${Date.now()}`,
          name: 'سحابة Google Drive (مجلد المزامنة)',
          path: picked.endsWith('ShamsBackups') ? picked : `${picked}\\ShamsBackups`,
          type: 'gdrive_folder',
          enabled: true
        });
        setShowDestinationModal(true);
      } else {
        // Fallback: invite user to choose folder
        setEditingDest({
          id: `dest-gdrive-${Date.now()}`,
          name: 'مجلد Google Drive للمزامنة',
          path: 'G:\\My Drive\\ShamsBackups',
          type: 'gdrive_folder',
          enabled: true
        });
        setShowDestinationModal(true);
      }
    } catch (e) {
      setEditingDest({
        id: `dest-gdrive-${Date.now()}`,
        name: 'مجلد Google Drive للمزامنة',
        path: 'G:\\My Drive\\ShamsBackups',
        type: 'gdrive_folder',
        enabled: true
      });
      setShowDestinationModal(true);
    }
  };

  // 7. إدارة Google Drive السحابي المباشر (Cloud API)
  const handleTestGDrive = async () => {
    if (!gDriveConfig.serviceAccountEmail || !gDriveConfig.serviceAccountKey) {
      alert('الرجاء إدخال بريد حساب الخدمة (Service Account Email) والمفتاح الخاص (Private Key).');
      return;
    }
    setIsTestingGDrive(true);
    setGDriveTestResult(null);
    try {
      const res = await testGoogleDriveConfig({
        email: gDriveConfig.serviceAccountEmail,
        key: gDriveConfig.serviceAccountKey,
        folderId: gDriveConfig.folderId
      });
      if (res.success) {
        setGDriveTestResult({ success: true, text: res.data?.message || 'تم الاتصال بحساب Google Drive بنجاح والتحقق من الصلاحيات!' });
      } else {
        setGDriveTestResult({ success: false, text: res.error || 'فشل الاتصال بحساب Google Drive.' });
      }
    } catch (e: any) {
      setGDriveTestResult({ success: false, text: e.message || 'حدث خطأ في الاتصال.' });
    } finally {
      setIsTestingGDrive(false);
    }
  };

  const handleSaveGDriveConfig = async () => {
    try {
      await saveBackupConfig({ googleDriveCloud: gDriveConfig });
      setConfig(prev => ({ ...prev, googleDriveCloud: gDriveConfig }));
      setShowGDriveModal(false);
      showNotification('success', 'تم حفظ إعدادات الربط مع Google Drive بنجاح.');
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleJsonCredentialsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.client_email && json.private_key) {
          setGDriveConfig(prev => ({
            ...prev,
            serviceAccountEmail: json.client_email,
            serviceAccountKey: json.private_key,
            enabled: true
          }));
          showNotification('success', 'تم استخراج بيانات الاعتماد من ملف JSON بنجاح.');
        } else {
          alert('الملف المرفق ليس ملف Google Service Account JSON صالح (ينقصه client_email أو private_key).');
        }
      } catch (err) {
        alert('ملف غير صالح أو تالف.');
      }
    };
    reader.readAsText(file);
  };

  // إحصائيات
  const totalSizeBytes = backups.reduce((acc, b) => acc + (b.size || 0), 0);
  const totalFormatted = (totalSizeBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const lastBackup = backups[0];
  const activeDestinations = (config.destinations || []).filter(d => d.enabled);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Alert Notification Toast */}
      {statusMessage && (
        <div 
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-md transition-all ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-bold text-sm">{statusMessage.text}</span>
          </div>
          <button 
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold px-2 py-1 bg-white/70 hover:bg-white rounded border transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Schedule */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">النسخ التلقائي</span>
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${config.autoBackupEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
              <span className={`w-2 h-2 rounded-full ${config.autoBackupEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {config.autoBackupEnabled ? 'نشط ومجدول' : 'معطل'}
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">مرتان يومياً</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>المواعيد: {config.time1 || '12:00'} ظهراً | {config.time2 || '18:00'} مساءً</span>
            </div>
          </div>
        </div>

        {/* Card 2: Multi-Destinations Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">مسارات الحفظ النشطة</span>
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>{activeDestinations.length} مسارات حفظ</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>تكرار متزامن في عدة أماكن</span>
              {config.googleDriveCloud?.enabled && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  + Google Drive Cloud
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Last Backup */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">آخر نسخة تم حفظها</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            {lastBackup ? (
              <>
                <div className="text-base font-black text-slate-800 truncate" title={lastBackup.fileName}>
                  {new Date(lastBackup.createdAt).toLocaleDateString('ar-LY')}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>{new Date(lastBackup.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-mono font-bold text-blue-700">({lastBackup.sizeFormatted})</span>
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-slate-400">لا توجد نسخ سابقة بعد</div>
            )}
          </div>
        </div>

        {/* Card 4: Total Storage */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">إجمالي النسخ بالمجلد الرئيسي</span>
            <Database className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">{backups.length} نسخة</div>
            <div className="text-xs text-slate-500 mt-1">
              المساحة المستهلكة: <span className="font-mono font-bold text-slate-700">{totalFormatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            disabled={!canManage || isCreating}
            onClick={handleCreateBackup}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>{isCreating ? 'جاري النسخ وتكرار الحفظ...' : 'إنشاء نسخة احتياطية يدوية الآن'}</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-lg font-bold text-sm border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="تحديث قائمة النسخ"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            disabled={!canManage}
            onClick={() => setShowScheduleModal(true)}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>مواعيد النسخ التلقائي</span>
          </button>

          <button
            disabled={!canManage}
            onClick={() => setShowGDriveModal(true)}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>ربط Google Drive السحابي</span>
            {config.googleDriveCloud?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>
      </div>

      {/* SECTION: Multi-Destinations Management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 mb-4">
          <div>
            <div className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>مسارات الحفظ والتكرار المتعددة (Multi-Destinations)</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                {activeDestinations.length} مسارات مفعلة
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              يقوم النظام تلقائياً بنسخ كل نسخة احتياطية إلى كافة هذه المسارات في نفس اللحظة (هارد ديسك، فلاش USB، ومجلد Google Drive).
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={!canManage}
              onClick={handleDetectGoogleDrive}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="إضافة مجلد Google Drive المثبت على الجهاز"
            >
              <FolderSync className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ إضافة مجلد Google Drive</span>
            </button>

            <button
              disabled={!canManage}
              onClick={handleOpenAddDestination}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مسار حفظ جديد</span>
            </button>
          </div>
        </div>

        {/* Destinations List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(config.destinations || []).map((dest) => {
            const isDefault = dest.isDefault;
            return (
              <div 
                key={dest.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  dest.enabled 
                    ? 'bg-slate-50/70 border-slate-300' 
                    : 'bg-slate-100/40 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {dest.type === 'gdrive_folder' ? (
                      <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : dest.type === 'external' ? (
                      <Usb className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : dest.type === 'network' ? (
                      <Network className="w-5 h-5 text-purple-600 shrink-0" />
                    ) : (
                      <HardDrive className="w-5 h-5 text-blue-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <span>{dest.name}</span>
                        {isDefault && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">
                            الرئيسي
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {dest.type === 'gdrive_folder' ? 'Google Drive Sync' : dest.type === 'external' ? 'USB / خارجي' : 'قرص محلي'}
                      </div>
                    </div>
                  </div>

                  {/* Enable / Disable Switch */}
                  <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canManage || isDefault}
                      checked={dest.enabled}
                      onChange={() => handleToggleDestination(dest.id, dest.enabled)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className={dest.enabled ? 'text-emerald-700' : 'text-slate-400'}>
                      {dest.enabled ? 'مفعل' : 'معطل'}
                    </span>
                  </label>
                </div>

                {/* Path representation */}
                <div className="p-1.5 bg-white rounded border border-slate-200 text-xs font-mono text-slate-600 truncate dir-ltr text-left mb-2.5" title={dest.path}>
                  {dest.path}
                </div>

                {/* Footer status & actions */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <div className="text-[11px] text-slate-500">
                    {dest.lastStatus === 'success' ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> تم النسخ بنجاح
                      </span>
                    ) : dest.lastStatus ? (
                      <span className="text-red-500 font-bold truncate max-w-[150px]" title={dest.lastStatus}>
                        ⚠️ {dest.lastStatus}
                      </span>
                    ) : (
                      <span className="text-slate-400">في انتظار أول نسخ</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTestDestination(dest.path)}
                      className="px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-200 rounded transition-colors"
                      title="فحص توفر المسار وصلاحية الكتابة"
                    >
                      {testingDestPath === dest.path ? 'فحص...' : 'فحص المسار'}
                    </button>
                    {!isDefault && canManage && (
                      <button
                        onClick={() => handleDeleteDestination(dest.id, dest.name)}
                        className="px-2 py-0.5 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="إزالة هذا المسار"
                      >
                        إزالة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <span>سجل ملفات النسخ الاحتياطي المحفوظة</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-bold">
              {backups.length}
            </span>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            تُحفظ النسخ بصيغة <span className="font-mono font-bold text-slate-700">.sqlite</span> المستقلة والمشفرة والجاهزة للاسترجاع الفوري.
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
            <div>جاري فحص وتحديث قائمة النسخ الاحتياطية...</div>
          </div>
        ) : backups.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <div className="text-lg font-bold text-slate-600 mb-1">لا توجد نسخ احتياطية حتى الآن</div>
            <div className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              اضغط على زر «إنشاء نسخة احتياطية يدوية الآن» لأخذ أول نسخة، أو انتظر حلول موعد النسخ التلقائي.
            </div>
            {canManage && (
              <button
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm cursor-pointer"
              >
                إنشاء أول نسخة احتياطية
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
                <tr>
                  <th className="p-3.5 text-center w-12">#</th>
                  <th className="p-3.5">اسم ملف النسخة</th>
                  <th className="p-3.5">تاريخ ووقت الإنشاء</th>
                  <th className="p-3.5 text-center">نوع النسخة</th>
                  <th className="p-3.5 text-center">الحجم</th>
                  <th className="p-3.5 text-center w-48">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 dir-ltr text-right justify-end">
                        <span className="truncate max-w-md">{item.fileName}</span>
                        <Database className="w-4 h-4 text-blue-600 shrink-0" />
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <div className="font-bold text-xs text-slate-800">
                        {new Date(item.createdAt).toLocaleDateString('ar-LY')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.createdAt).toLocaleTimeString('ar-LY')}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      {item.type === 'auto' ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> تلقائية
                        </span>
                      ) : item.type === 'pre_restore' ? (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> أمان قبل الاستعادة
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> يدوية
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-xs text-slate-700">
                      {item.sizeFormatted}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Download / Export */}
                        <button
                          onClick={() => handleExport(item.fileName)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 cursor-pointer"
                          title="حفظ باسم / تنزيل النسخة"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Restore */}
                        <button
                          disabled={!canManage || isRestoring === item.fileName}
                          onClick={() => handleRestore(item)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                          title="استعادة قاعدة البيانات من هذه النسخة"
                        >
                          {isRestoring === item.fileName ? (
                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-amber-800 border-t-transparent rounded-full" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>استعادة</span>
                        </button>

                        {/* Delete */}
                        <button
                          disabled={!canManage}
                          onClick={() => handleDelete(item.fileName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 disabled:opacity-30 cursor-pointer"
                          title="حذف هذا الملف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Add/Edit Destination */}
      {showDestinationModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
                <Folder className="w-5 h-5 text-indigo-600" />
                <span>إضافة مسار حفظ إضافي للنسخ الاحتياطي</span>
              </div>
              <button 
                onClick={() => setShowDestinationModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المسار التوضيحي <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium text-sm"
                  placeholder="مثال: فلاش ديسك خارجي E:\ أو مجلد Google Drive"
                  value={editingDest.name || ''}
                  onChange={e => setEditingDest({ ...editingDest, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع المسار
                </label>
                <select
                  value={editingDest.type || 'local'}
                  onChange={e => setEditingDest({ ...editingDest, type: e.target.value as any })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-bold text-sm text-slate-700"
                >
                  <option value="local">قرص محلي ثانوي (مثل D:\Backups)</option>
                  <option value="gdrive_folder">مجلد Google Drive للمزامنة السحابية (G:\My Drive)</option>
                  <option value="external">فلاش ميموري / هارد ديسك خارجي (USB)</option>
                  <option value="network">مجلد شبكة مشترك (NAS / Shared Network Folder)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مسار المجلد على الجهاز <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    className="flex-1 p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-mono text-xs text-left"
                    placeholder="E:\ShamsBackups أو G:\My Drive\ShamsBackups"
                    value={editingDest.path || ''}
                    onChange={e => setEditingDest({ ...editingDest, path: e.target.value })}
                  />
                  {isElectron() && (
                    <button
                      type="button"
                      onClick={handlePickFolder}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>استعراض</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Test Button & Result */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleTestDestination(editingDest.path || '')}
                  disabled={!editingDest.path || !!testingDestPath}
                  className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{testingDestPath ? 'جاري فحص المسار...' : 'فحص توفر المسار وصلاحية الكتابة'}</span>
                </button>

                {destTestResult && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs font-bold ${
                    destTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {destTestResult.text}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowDestinationModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveDestination}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ المسار</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Google Drive Direct Cloud API Integration */}
      {showGDriveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
                <Cloud className="w-5 h-5 text-blue-600" />
                <span>الربط السحابي المباشر مع Google Drive (Cloud API)</span>
              </div>
              <button 
                onClick={() => setShowGDriveModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Enable Toggle */}
              <label className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={gDriveConfig.enabled}
                  onChange={(e) => setGDriveConfig({ ...gDriveConfig, enabled: e.target.checked })}
                />
                <div>
                  <div className="font-bold text-slate-800 text-sm">تفعيل الرفع التلقائي إلى سحابة Google Drive</div>
                  <div className="text-xs text-slate-500">يقوم النظام برفع نسخة احتياطية مباشرة لحسابك على Google Drive فور إنشائها.</div>
                </div>
              </label>

              {/* Upload Service Account JSON */}
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
                <UploadCloud className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700 mb-1">
                  استيراد بيانات الاعتماد من ملف Google Service Account JSON
                </div>
                <div className="text-[11px] text-slate-500 mb-3">
                  يمكنك استخراج ملف المفتاح الخاص بحساب الخدمة من Google Cloud Console وتحميله مباشرة هنا.
                </div>
                <label className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>اختيار ملف JSON الاعتماد</span>
                  <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    onChange={handleJsonCredentialsUpload} 
                  />
                </label>
              </div>

              {/* Service Account Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  بريد حساب الخدمة (Service Account Email)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono text-xs text-left"
                  placeholder="shams-backup@project.iam.gserviceaccount.com"
                  value={gDriveConfig.serviceAccountEmail || ''}
                  onChange={e => setGDriveConfig({ ...gDriveConfig, serviceAccountEmail: e.target.value.trim() })}
                />
              </div>

              {/* Private Key */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المفتاح الخاص (Private Key)
                </label>
                <textarea
                  dir="ltr"
                  rows={3}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono text-[11px] text-left"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  value={gDriveConfig.serviceAccountKey || ''}
                  onChange={e => setGDriveConfig({ ...gDriveConfig, serviceAccountKey: e.target.value })}
                />
              </div>

              {/* Folder ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  معرّف مجلد Google Drive (اختياري لحفظ النسخ داخل مجلد معين)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono text-xs text-left"
                  placeholder="مثال: 1a2B3c4D5e6F7g8H9..."
                  value={gDriveConfig.folderId || ''}
                  onChange={e => setGDriveConfig({ ...gDriveConfig, folderId: e.target.value.trim() })}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  تنبيه: تأكد من مشاركة المجلد في Google Drive مع بريد حساب الخدمة مع منحه صلاحية (محرر - Editor).
                </div>
              </div>

              {/* Test Connection Button & Result */}
              <div>
                <button
                  type="button"
                  onClick={handleTestGDrive}
                  disabled={isTestingGDrive || !gDriveConfig.serviceAccountEmail}
                  className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingGDrive ? 'animate-spin' : ''}`} />
                  <span>{isTestingGDrive ? 'جاري فحص الاتصال بجوجل درايف...' : 'فحص واختبار الاتصال بالسحابة'}</span>
                </button>

                {gDriveTestResult && (
                  <div className={`mt-2 p-3 rounded-lg text-xs font-bold ${
                    gDriveTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {gDriveTestResult.text}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowGDriveModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveGDriveConfig}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Schedule Settings */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>إعدادات النسخ الاحتياطي التلقائي (مرتان يومياً)</span>
              </div>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Enable Toggle */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  checked={config.autoBackupEnabled}
                  onChange={(e) => setConfig({ ...config, autoBackupEnabled: e.target.checked })}
                />
                <div>
                  <div className="font-bold text-slate-800 text-sm">تفعيل النسخ الاحتياطي التلقائي مرتين يومياً</div>
                  <div className="text-xs text-slate-500">يقوم النظام تلقائياً بأخذ نسختين يومياً وتكرارها في كافة المسارات المفعلة.</div>
                </div>
              </label>

              {/* Time 1 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  موعد النسخة الأولى (الافتراضي: 12:00 ظهراً - منتصف الدوام)
                </label>
                <input
                  type="time"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-mono font-bold text-slate-800 text-base"
                  value={config.time1 || '12:00'}
                  onChange={(e) => setConfig({ ...config, time1: e.target.value })}
                />
              </div>

              {/* Time 2 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  موعد النسخة الثانية (الافتراضي: 18:00 مساءً - نهاية الدوام)
                </label>
                <input
                  type="time"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-mono font-bold text-slate-800 text-base"
                  value={config.time2 || '18:00'}
                  onChange={(e) => setConfig({ ...config, time2: e.target.value })}
                />
              </div>

              {/* Retention limit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الحد الأقصى للاحتفاظ بالنسخ التلقائية القديمة في كل مسار
                </label>
                <select
                  value={config.maxBackupsToKeep || 60}
                  onChange={(e) => setConfig({ ...config, maxBackupsToKeep: Number(e.target.value) })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-sm font-bold text-slate-700"
                >
                  <option value={30}>30 نسخة (حوالي 15 يوماً)</option>
                  <option value={60}>60 نسخة (حوالي 30 يوماً - شهر كامل) [موصى به]</option>
                  <option value={90}>90 نسخة (حوالي 45 يوماً)</option>
                  <option value={120}>120 نسخة (حوالي 60 يوماً - شهران)</option>
                </select>
                <div className="text-xs text-slate-400 mt-1">
                  يقوم النظام بحذف النسخ التلقائية الأقدم تلقائياً لتوفير مساحة التخزين على القرص.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  await saveBackupConfig(config);
                  setShowScheduleModal(false);
                  showNotification('success', 'تم حفظ إعدادات مواعيد النسخ التلقائي بنجاح.');
                }}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
