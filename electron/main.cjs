const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/index.cjs');
const { registerIpcHandlers } = require('./database/ipcHandlers.cjs');
const { createApiServer } = require('./server.cjs');

// Enforce single instance lock so running in background won't be duplicated
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[main] Another instance of Shams App is already running. Quitting duplicate instance.');
  app.quit();
} else {
  const configPath = path.join(app.getPath('userData'), app.isPackaged ? 'db_config.json' : 'db_config_dev.json');
  let dataPath = path.join(app.getPath('documents'), app.isPackaged ? 'ShamsAppData/ShamsAppData.json' : 'ShamsAppData_dev/ShamsAppData.json');
  let runInBackground = true; // Enabled by default to protect background server from accidental closure

  function saveAppConfig(updates) {
    try {
      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
      Object.assign(config, updates);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving config:', e);
    }
  }

  // Check if custom configurations exist
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.customDbPath) {
        dataPath = config.customDbPath;
      }
      if (typeof config.runInBackground === 'boolean') {
        runInBackground = config.runInBackground;
      }
    } catch (e) {
      console.error('Error reading db config:', e);
    }
  }

  let mainWindow = null;
  let tray = null;
  let isQuitting = false;
  let hasShownTrayBalloon = false;

  function showAndFocusWindow() {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }

  function showTrayBalloon() {
    if (tray && !hasShownTrayBalloon && process.platform === 'win32') {
      hasShownTrayBalloon = true;
      try {
        tray.displayBalloon({
          iconType: 'info',
          title: 'منظومة الشمس للمقطورات',
          content: 'المنظومة مستمرة في العمل في الخلفية لخدمة الأجهزة المتصلة على الشبكة. يمكنك فتح النافذة في أي وقت من شريط المهام.'
        });
      } catch (e) {
        console.warn('Tray balloon failed:', e);
      }
    }
  }

  function createTray() {
    if (tray) return;

    const iconPath = path.join(__dirname, 'tray-icon.png');
    let icon;
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        icon = icon.resize({ width: 16, height: 16 });
      }
    }

    if (!icon || icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }

    try {
      tray = new Tray(icon);
      tray.setToolTip('منظومة الشمس للمقطورات - الخادم نشط في الخلفية');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'فتح منظومة الشمس',
          click: () => showAndFocusWindow()
        },
        { type: 'separator' },
        {
          label: '🟢 خادم الشبكة نشط ومتصل',
          enabled: false
        },
        {
          label: 'إظهار النافذة الرئيسية',
          click: () => showAndFocusWindow()
        },
        { type: 'separator' },
        {
          label: 'إغلاق المنظومة نهائياً والخروج',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]);

      tray.setContextMenu(contextMenu);

      tray.on('click', () => {
        showAndFocusWindow();
      });

      tray.on('double-click', () => {
        showAndFocusWindow();
      });

      tray.on('balloon-click', () => {
        showAndFocusWindow();
      });
    } catch (err) {
      console.error('[main] Failed to create system tray:', err);
    }
  }

  function createWindow() {
    const iconPath = path.join(__dirname, 'tray-icon.png');
    const hasIcon = fs.existsSync(iconPath);

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      icon: hasIcon ? iconPath : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true
      },
      autoHideMenuBar: true
    });

    // Intercept close button to hide to tray when background mode is active
    mainWindow.on('close', (event) => {
      if (!isQuitting && runInBackground) {
        event.preventDefault();
        mainWindow.hide();
        showTrayBalloon();
        return false;
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    
    if (app.isPackaged || !process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
      // Fallback for dev mode when running vite dev server
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
  }

  // When a second instance is launched, focus our existing window
  app.on('second-instance', () => {
    showAndFocusWindow();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.whenReady().then(async () => {
    const dbFolderPath = path.dirname(dataPath);
    await initDatabase(dbFolderPath);
    registerIpcHandlers();

    // Start the HTTP API server so client machines on the local network can connect
    try {
      await createApiServer();
    } catch (err) {
      console.error('[main] API server failed to start:', err.message);
    }

    createWindow();
    createTray();

    ipcMain.on('set-autostart', (event, enable) => {
      app.setLoginItemSettings({
        openAtLogin: enable,
        path: app.getPath('exe'),
        args: app.isPackaged ? [] : [app.getAppPath()]
      });
      event.returnValue = true;
    });

    ipcMain.on('get-autostart', (event) => {
      const settings = app.getLoginItemSettings();
      event.returnValue = settings.openAtLogin;
    });

    ipcMain.on('get-run-in-background', (event) => {
      event.returnValue = runInBackground;
    });

    ipcMain.on('set-run-in-background', (event, enable) => {
      runInBackground = Boolean(enable);
      saveAppConfig({ runInBackground });
      event.returnValue = true;
    });

    ipcMain.on('quit-app', () => {
      isQuitting = true;
      app.quit();
    });

    ipcMain.on('get-db-path', (event) => {
      event.returnValue = dataPath;
    });

    ipcMain.on('change-db-path', (event) => {
      const result = dialog.showOpenDialogSync({
        title: 'اختر مجلد قاعدة البيانات (الشبكة أو المحلي)',
        properties: ['openDirectory']
      });

      if (result && result.length > 0) {
        const selectedFolder = result[0];
        const newDataPath = path.join(selectedFolder, 'ShamsAppData.json');
        
        saveAppConfig({ customDbPath: newDataPath });
        dataPath = newDataPath;
        event.returnValue = dataPath;
      } else {
        event.returnValue = null;
      }
    });

    ipcMain.on('select-folder', (event, title) => {
      const result = dialog.showOpenDialogSync({
        title: title || 'اختر مساراً',
        properties: ['openDirectory']
      });
      if (result && result.length > 0) {
        event.returnValue = result[0];
      } else {
        event.returnValue = null;
      }
    });

    // ── Backup System IPC Endpoints ──────────────────────────────────────────
    const backupManager = require('./database/backupManager.cjs');
    backupManager.startBackupScheduler();

    ipcMain.handle('backup-list', async () => {
      try {
        return backupManager.listBackups();
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-create', async (event, type) => {
      try {
        return await backupManager.createBackup(type || 'manual');
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-restore', async (event, fileName) => {
      try {
        return await backupManager.restoreBackup(fileName);
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-delete', async (event, fileName) => {
      try {
        return backupManager.deleteBackup(fileName);
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-get-config', async () => {
      try {
        return { success: true, data: backupManager.getConfig(), backupFolder: backupManager.getBackupFolder() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-set-config', async (event, cfg) => {
      try {
        const saved = backupManager.saveConfig(cfg);
        return { success: true, data: saved };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-open-folder', async () => {
      try {
        const folder = backupManager.getBackupFolder();
        await shell.openPath(folder);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-change-folder', async () => {
      try {
        const result = dialog.showOpenDialogSync({
          title: 'اختر مجلد حفظ النسخ الاحتياطية (USB / فلاش ديسك / هارد ديسك خارجي)',
          properties: ['openDirectory', 'createDirectory']
        });
        if (result && result.length > 0) {
          const newFolder = result[0];
          const saved = backupManager.saveConfig({ customBackupFolder: newFolder });
          return { success: true, data: saved, backupFolder: newFolder };
        }
        return { success: false, canceled: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-pick-folder', async (event, title) => {
      try {
        const result = dialog.showOpenDialogSync({
          title: title || 'اختر مجلد حفظ النسخ الاحتياطية',
          properties: ['openDirectory', 'createDirectory']
        });
        if (result && result.length > 0) {
          return { success: true, folderPath: result[0] };
        }
        return { success: false, canceled: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('backup-test-destination', async (event, folderPath) => {
      return backupManager.testFolderAccess(folderPath);
    });

    ipcMain.handle('backup-test-gdrive', async (event, params) => {
      const { email, key, folderId } = params || {};
      return await backupManager.testGoogleDriveConnection(email, key, folderId);
    });

    ipcMain.handle('backup-detect-gdrive', async () => {
      return { success: true, data: backupManager.detectLocalGoogleDrivePaths() };
    });

    ipcMain.handle('backup-export-file', async (event, fileName) => {
      try {
        const srcPath = path.join(backupManager.getBackupFolder(), path.basename(fileName));
        if (!fs.existsSync(srcPath)) throw new Error('ملف النسخة الاحتياطية غير موجود.');
        
        const win = BrowserWindow.fromWebContents(event.sender);
        const { filePath } = await dialog.showSaveDialog(win, {
          title: 'حفظ النسخة الاحتياطية باسم',
          defaultPath: fileName,
          filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
        });

        if (filePath) {
          fs.copyFileSync(srcPath, filePath);
          return { success: true, filePath };
        }
        return { success: false, canceled: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('print-to-pdf', async (event, defaultName) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const defaultPath = path.join(app.getPath('documents'), defaultName || 'Document.pdf');
      const { filePath } = await dialog.showSaveDialog(win, {
        title: 'حفظ كـ PDF',
        defaultPath: defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (filePath) {
        try {
          const pdf = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            marginType: 'custom',
            margins: { top: 0, bottom: 0, left: 0, right: 0 }
          });
          fs.writeFileSync(filePath, pdf);
          return true;
        } catch (error) {
          console.error('PDF error:', error);
          return false;
        }
      }
      return false;
    });

    ipcMain.handle('export-pdf-silently', async (event, fileName, targetFolder) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const filePath = path.join(targetFolder, fileName);
      try {
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
        }
        const pdf = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          marginType: 'custom',
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });
        fs.writeFileSync(filePath, pdf);
        shell.showItemInFolder(filePath);
        return true;
      } catch (error) {
        console.error('Silent PDF error:', error);
        return false;
      }
    });

    ipcMain.handle('print-direct', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      try {
        await win.webContents.print({
          silent: true,
          printBackground: true,
          pageSize: 'A4',
          margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
        });
        return true;
      } catch (error) {
        console.error('Print error:', error);
        return false;
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        showAndFocusWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && (!runInBackground || isQuitting)) {
      app.quit();
    }
  });
}
