const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // SQLite Database Endpoints
  dbGetCollection: (table) => ipcRenderer.invoke('db-get-collection', table),
  dbBulkUpsert: (table, items) => ipcRenderer.invoke('db-bulk-upsert', table, items),
  dbBulkDelete: (table, ids) => ipcRenderer.invoke('db-bulk-delete', table, ids),
  dbGetObject: (key) => ipcRenderer.invoke('db-get-object', key),
  dbSetObject: (key, value) => ipcRenderer.invoke('db-set-object', key, value),
  getMigrationStatus: () => ipcRenderer.invoke('get-migration-status'),

  // Existing App/Settings Endpoints
  setAutostart: (enable) => ipcRenderer.sendSync('set-autostart', enable),
  getAutostart: () => ipcRenderer.sendSync('get-autostart'),
  getDbPath: () => ipcRenderer.sendSync('get-db-path'),
  changeDbPath: () => ipcRenderer.sendSync('change-db-path'),
  selectFolder: (title) => ipcRenderer.sendSync('select-folder', title),
  
  // PDF / Print
  printToPDF: (defaultName) => ipcRenderer.invoke('print-to-pdf', defaultName),
  exportPdfSilently: (fileName, targetFolder) => ipcRenderer.invoke('export-pdf-silently', fileName, targetFolder),
  printDirect: () => ipcRenderer.invoke('print-direct')
});
