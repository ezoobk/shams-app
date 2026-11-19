const path = require('path');
const fs = require('fs');
const { getDb, getDbFolder, getDbPath, closeDatabase, reopenDatabase } = require('./index.cjs');
const { 
  testGoogleDriveConnection, 
  uploadFileToGoogleDrive, 
  detectLocalGoogleDrivePaths 
} = require('./googleDriveUploader.cjs');

let electronApp;
try { electronApp = require('electron').app; } catch (e) {}

function getConfigPath() {
  if (electronApp) {
    return path.join(electronApp.getPath('userData'), electronApp.isPackaged ? 'backup_config.json' : 'backup_config_dev.json');
  }
  const home = process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(home, 'Documents', 'ShamsAppData_dev', 'backup_config.json');
}

function getDefaultBackupFolder() {
  const dbFolder = getDbFolder() || path.join(process.env.USERPROFILE || '.', 'Documents', 'ShamsAppData');
  const def = path.join(dbFolder, 'Backups');
  if (!fs.existsSync(def)) {
    try { fs.mkdirSync(def, { recursive: true }); } catch (e) {}
  }
  return def;
}

const DEFAULT_CONFIG = {
  autoBackupEnabled: true,
  time1: '12:00', // النسخة الأولى: 12:00 ظهراً
  time2: '18:00', // النسخة الثانية: 06:00 مساءً
  maxBackupsToKeep: 60, // الاحتفاظ بآخر 60 نسخة تلقائية
  destinations: [],
  googleDriveCloud: {
    enabled: false,
    folderId: '',
    serviceAccountEmail: '',
    serviceAccountKey: '',
    lastUploadTime: null,
    lastUploadFile: null,
    lastUploadStatus: null
  },
  lastBackupTime: null,
  lastBackupFileName: null,
  lastBackupType: null,
  lastSlot1Date: null,
  lastSlot2Date: null
};

function getConfig() {
  const cfgPath = getConfigPath();
  let cfg = { ...DEFAULT_CONFIG };
  if (fs.existsSync(cfgPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      cfg = { ...DEFAULT_CONFIG, ...data };
    } catch (e) {
      console.error('[BackupManager] Error reading config:', e.message);
    }
  }

  // التأكد من وجود المسار الافتراضي المحلي دائماً
  const defPath = getDefaultBackupFolder();
  if (!Array.isArray(cfg.destinations) || cfg.destinations.length === 0) {
    cfg.destinations = [
      {
        id: 'dest-default',
        name: 'المجلد المحلي الافتراضي',
        path: defPath,
        type: 'local',
        enabled: true,
        isDefault: true,
        lastBackupTime: cfg.lastBackupTime || null,
        lastStatus: 'success'
      }
    ];
  } else {
    // تحديث مسار المسار الافتراضي إذا تغير
    const defDest = cfg.destinations.find(d => d.isDefault);
    if (defDest && !defDest.path) {
      defDest.path = defPath;
    }
  }

  return cfg;
}

function saveConfig(updates) {
  try {
    const cfgPath = getConfigPath();
    const dir = path.dirname(cfgPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const current = getConfig();
    const merged = { ...current, ...updates };
    fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (e) {
    console.error('[BackupManager] Error saving config:', e.message);
    return getConfig();
  }
}

function getPrimaryBackupFolder() {
  const cfg = getConfig();
  const defDest = (cfg.destinations || []).find(d => d.isDefault && d.enabled);
  if (defDest && defDest.path) {
    if (!fs.existsSync(defDest.path)) {
      try { fs.mkdirSync(defDest.path, { recursive: true }); } catch (e) {}
    }
    return defDest.path;
  }
  return getDefaultBackupFolder();
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * إنشاء نسخة احتياطية وحفظها في كافة المسارات النشطة المحددة + Google Drive
 */
async function createBackup(type = 'manual', options = {}) {
  const db = getDb();
  const cfg = getConfig();
  const primaryFolder = options.targetFolder || getPrimaryBackupFolder();
  if (!fs.existsSync(primaryFolder)) {
    fs.mkdirSync(primaryFolder, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  
  let prefix = 'Manual';
  if (type === 'auto') prefix = 'Auto';
  else if (type === 'pre_restore') prefix = 'PreRestore';

  const fileName = `ShamsBackup_${prefix}_${dateStr}.sqlite`;
  const primaryFilePath = path.join(primaryFolder, fileName);
  const safePrimaryPath = primaryFilePath.replace(/\\/g, '/');

  console.log(`[BackupManager] Starting ${type} backup into primary path: ${safePrimaryPath}`);
  await db.run(`VACUUM INTO '${safePrimaryPath}'`);

  if (!fs.existsSync(primaryFilePath)) {
    throw new Error('فشل إنشاء ملف النسخة الاحتياطية على القرص.');
  }

  const stats = fs.statSync(primaryFilePath);

  // 1. تكرار ونسخ الملف إلى كافة المسارات الإضافية المفعلة (Multi-Destinations)
  const destinationsResults = [];
  const updatedDestinations = [...(cfg.destinations || [])];

  for (const dest of updatedDestinations) {
    if (!dest.enabled) continue;
    
    // المسار الافتراضي تم الحفظ فيه مباشرة
    if (path.resolve(dest.path) === path.resolve(primaryFolder)) {
      dest.lastBackupTime = now.toISOString();
      dest.lastStatus = 'success';
      destinationsResults.push({ id: dest.id, name: dest.name, status: 'success', path: dest.path });
      continue;
    }

    try {
      if (!fs.existsSync(dest.path)) {
        fs.mkdirSync(dest.path, { recursive: true });
      }
      const targetFilePath = path.join(dest.path, fileName);
      fs.copyFileSync(primaryFilePath, targetFilePath);
      dest.lastBackupTime = now.toISOString();
      dest.lastStatus = 'success';
      destinationsResults.push({ id: dest.id, name: dest.name, status: 'success', path: targetFilePath });
      console.log(`[BackupManager] Replicated backup to [${dest.name}]: ${targetFilePath}`);

      // تنظيف النسخ القديمة في هذا المسار إذا كانت تلقائية
      if (type === 'auto') {
        pruneOldBackupsInFolder(dest.path, cfg.maxBackupsToKeep || 60);
      }
    } catch (copyErr) {
      dest.lastStatus = `فشل: ${copyErr.message}`;
      destinationsResults.push({ id: dest.id, name: dest.name, status: 'failed', error: copyErr.message });
      console.warn(`[BackupManager] Failed to copy backup to [${dest.name}]:`, copyErr.message);
    }
  }

  // تنظيف النسخ القديمة في المجلد الرئيسي
  if (type === 'auto') {
    pruneOldBackupsInFolder(primaryFolder, cfg.maxBackupsToKeep || 60);
  }

  // 2. الرفع المباشر إلى Google Drive السحابي إذا كان مفعلاً
  let googleDriveUploadResult = null;
  const gDrive = cfg.googleDriveCloud;
  if (gDrive && gDrive.enabled && gDrive.serviceAccountEmail && gDrive.serviceAccountKey) {
    console.log('[BackupManager] Uploading backup to Google Drive Cloud...');
    try {
      const gRes = await uploadFileToGoogleDrive(
        primaryFilePath,
        fileName,
        gDrive.serviceAccountEmail,
        gDrive.serviceAccountKey,
        gDrive.folderId
      );
      gDrive.lastUploadTime = now.toISOString();
      gDrive.lastUploadFile = fileName;
      gDrive.lastUploadStatus = 'success';
      googleDriveUploadResult = { success: true, fileId: gRes.fileId };
    } catch (gErr) {
      gDrive.lastUploadStatus = `فشل: ${gErr.message}`;
      googleDriveUploadResult = { success: false, error: gErr.message };
      console.error('[BackupManager] Google Drive upload failed:', gErr.message);
    }
  }

  saveConfig({
    lastBackupTime: now.toISOString(),
    lastBackupFileName: fileName,
    lastBackupType: type,
    destinations: updatedDestinations,
    googleDriveCloud: gDrive
  });

  console.log(`[BackupManager] Backup completed successfully: ${fileName} (${formatBytes(stats.size)})`);

  const backupResult = {
    success: true,
    fileName,
    filePath: primaryFilePath,
    size: stats.size,
    sizeFormatted: formatBytes(stats.size),
    createdAt: now.toISOString(),
    type,
    destinationsResults,
    googleDriveUploadResult
  };

  return {
    ...backupResult,
    data: backupResult
  };
}

function pruneOldBackupsInFolder(folder, maxKeep) {
  try {
    const autoFiles = fs.readdirSync(folder)
      .filter(f => f.startsWith('ShamsBackup_Auto_') && f.endsWith('.sqlite'))
      .map(f => ({ name: f, time: fs.statSync(path.join(folder, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (autoFiles.length > maxKeep) {
      for (let i = maxKeep; i < autoFiles.length; i++) {
        try {
          fs.unlinkSync(path.join(folder, autoFiles[i].name));
        } catch (e) {}
      }
    }
  } catch (err) {}
}

/**
 * جلب قائمة النسخ الاحتياطية المحفوظة
 */
function listBackups() {
  const folder = getPrimaryBackupFolder();
  const cfg = getConfig();
  if (!fs.existsSync(folder)) {
    return { success: true, data: [], backupFolder: folder, config: cfg };
  }

  const files = fs.readdirSync(folder)
    .filter(f => f.endsWith('.sqlite'))
    .map(file => {
      try {
        const fullPath = path.join(folder, file);
        const stats = fs.statSync(fullPath);
        let type = 'manual';
        if (file.includes('_Auto_')) type = 'auto';
        else if (file.includes('_PreRestore_')) type = 'pre_restore';

        return {
          id: file,
          fileName: file,
          filePath: fullPath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
          type
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    success: true,
    data: files,
    backupFolder: folder,
    config: cfg
  };
}

/**
 * فحص صلاحية وجود مسار مجلد والكتابة فيه
 */
function testFolderAccess(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    // تجربة كتابة ملف مؤقت
    const testFile = path.join(folderPath, `.shams_test_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test', 'utf-8');
    fs.unlinkSync(testFile);
    return { success: true, accessible: true };
  } catch (err) {
    return { success: false, accessible: false, error: err.message };
  }
}

/**
 * استعادة نسخة احتياطية مع إنشاء نسخة أمان تلقائية قبل الاستعادة
 */
async function restoreBackup(backupFileNameOrPath) {
  let sourcePath = backupFileNameOrPath;
  if (!path.isAbsolute(sourcePath)) {
    sourcePath = path.join(getPrimaryBackupFolder(), path.basename(sourcePath));
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error('ملف النسخة الاحتياطية المطلوب غير موجود.');
  }

  // التحقق من صحة ترويسة ملف SQLite
  const fd = fs.openSync(sourcePath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);
  const header = buffer.toString('utf-8');
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('الملف المحدد ليس ملف قاعدة بيانات SQLite صالح.');
  }

  console.log(`[BackupManager] Preparing to restore from: ${sourcePath}`);

  // إنشاء نسخة أمان تلقائية لقاعدة البيانات الحالية قبل الاستبدال
  try {
    await createBackup('pre_restore');
  } catch (preErr) {
    console.warn('[BackupManager] Could not create pre-restore snapshot:', preErr.message);
  }

  const currentDbPath = getDbPath();
  if (!currentDbPath) {
    throw new Error('تعذر تحديد مسار قاعدة البيانات الحالية.');
  }

  await closeDatabase();

  fs.copyFileSync(sourcePath, currentDbPath);

  const walPath = currentDbPath + '-wal';
  const shmPath = currentDbPath + '-shm';
  if (fs.existsSync(walPath)) { try { fs.unlinkSync(walPath); } catch (e) {} }
  if (fs.existsSync(shmPath)) { try { fs.unlinkSync(shmPath); } catch (e) {} }

  await reopenDatabase();

  console.log('[BackupManager] Database restored and reopened successfully!');

  return {
    success: true,
    message: 'تمت استعادة النسخة الاحتياطية بنجاح وتم تحديث كافة البيانات.'
  };
}

/**
 * حذف ملف نسخة احتياطية
 */
function deleteBackup(fileName) {
  const safeName = path.basename(fileName);
  const folder = getPrimaryBackupFolder();
  const filePath = path.join(folder, safeName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true };
  } else {
    throw new Error('الملف المراد حذفه غير موجود.');
  }
}

/**
 * مشغل النسخ الاحتياطي التلقائي (مرتين يومياً)
 */
let schedulerInterval = null;

function checkAndRunScheduledBackups() {
  const cfg = getConfig();
  if (!cfg.autoBackupEnabled) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const [h1, m1] = (cfg.time1 || '12:00').split(':').map(Number);
  const [h2, m2] = (cfg.time2 || '18:00').split(':').map(Number);

  // فحص موعد النسخة الأولى (الافتراضي: 12:00 ظهراً)
  const slot1Passed = (currentHour > h1) || (currentHour === h1 && currentMinute >= m1);
  if (slot1Passed && cfg.lastSlot1Date !== todayDateStr) {
    console.log(`[BackupScheduler] Running scheduled Slot 1 backup for ${todayDateStr}...`);
    saveConfig({ lastSlot1Date: todayDateStr });
    createBackup('auto').catch(err => console.error('[BackupScheduler] Slot 1 backup error:', err.message));
  }

  // فحص موعد النسخة الثانية (الافتراضي: 18:00 مساءً)
  const slot2Passed = (currentHour > h2) || (currentHour === h2 && currentMinute >= m2);
  if (slot2Passed && cfg.lastSlot2Date !== todayDateStr) {
    console.log(`[BackupScheduler] Running scheduled Slot 2 backup for ${todayDateStr}...`);
    saveConfig({ lastSlot2Date: todayDateStr });
    createBackup('auto').catch(err => console.error('[BackupScheduler] Slot 2 backup error:', err.message));
  }
}

function startBackupScheduler() {
  if (schedulerInterval) return;
  setTimeout(() => {
    try {
      checkAndRunScheduledBackups();
    } catch (e) {
      console.warn('[BackupScheduler] Initial tick warning:', e.message);
    }
  }, 10000);

  schedulerInterval = setInterval(() => {
    try {
      checkAndRunScheduledBackups();
    } catch (e) {
      console.warn('[BackupScheduler] Tick error:', e.message);
    }
  }, 60000);

  console.log('[BackupScheduler] Automatic backup scheduler started (2 times daily with multi-destination support).');
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupFolder: getPrimaryBackupFolder,
  getConfig,
  saveConfig,
  startBackupScheduler,
  testFolderAccess,
  testGoogleDriveConnection,
  detectLocalGoogleDrivePaths
};
