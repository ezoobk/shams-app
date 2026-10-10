const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/index.cjs');
const { registerIpcHandlers } = require('./database/ipcHandlers.cjs');
const { createApiServer } = require('./server.cjs');

const configPath = path.join(app.getPath('userData'), app.isPackaged ? 'db_config.json' : 'db_config_dev.json');
let dataPath = path.join(app.getPath('documents'), app.isPackaged ? 'ShamsAppData/ShamsAppData.json' : 'ShamsAppData_dev/ShamsAppData.json');

// Check if a custom path is set for network sharing
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.customDbPath) {
      dataPath = config.customDbPath;
    }
  } catch (e) {
    console.error('Error reading db config:', e);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });
  
  if (app.isPackaged || !process.env.VITE_DEV_SERVER_URL) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Fallback for dev mode when running vite dev server
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  }
}

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

  // Synchronous read
    
  // Synchronous write
  
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
      
      // Save this new path to the local config
      fs.writeFileSync(configPath, JSON.stringify({ customDbPath: newDataPath }), 'utf-8');
      
      // Update runtime variable
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
