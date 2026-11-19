const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // SQLite Database Endpoints
  dbGetCollection: (table) => ipcRenderer.invoke('db-get-collection', table),
  dbGetAuditLog: (id) => ipcRenderer.invoke('db-get-audit-log', id),
  dbGetEstimateAttachments: (id) => ipcRenderer.invoke('db-get-estimate-attachments', id),
  dbGetWorkOrder: (id) => ipcRenderer.invoke('db-get-work-order', id),
  dbBulkUpsert: (table, items) => ipcRenderer.invoke('db-bulk-upsert', table, items),
  dbBulkDelete: (table, ids) => ipcRenderer.invoke('db-bulk-delete', table, ids),
  dbGetObject: (key) => ipcRenderer.invoke('db-get-object', key),
  dbSetObject: (key, value) => ipcRenderer.invoke('db-set-object', key, value),
  dbGenerateId: (params) => ipcRenderer.invoke('db-generate-id', params),
  getMigrationStatus: () => ipcRenderer.invoke('get-migration-status'),

  // Existing App/Settings Endpoints
  setAutostart: (enable) => ipcRenderer.sendSync('set-autostart', enable),
  getAutostart: () => ipcRenderer.sendSync('get-autostart'),
  getRunInBackground: () => ipcRenderer.sendSync('get-run-in-background'),
  setRunInBackground: (enable) => ipcRenderer.sendSync('set-run-in-background', enable),
  quitApp: () => ipcRenderer.send('quit-app'),
  getDbPath: () => ipcRenderer.sendSync('get-db-path'),
  changeDbPath: () => ipcRenderer.sendSync('change-db-path'),
  selectFolder: (title) => ipcRenderer.sendSync('select-folder', title),
  
  // Backup System Endpoints
  backupList: () => ipcRenderer.invoke('backup-list'),
  backupCreate: (type) => ipcRenderer.invoke('backup-create', type),
  backupRestore: (fileName) => ipcRenderer.invoke('backup-restore', fileName),
  backupDelete: (fileName) => ipcRenderer.invoke('backup-delete', fileName),
  backupGetConfig: () => ipcRenderer.invoke('backup-get-config'),
  backupSetConfig: (cfg) => ipcRenderer.invoke('backup-set-config', cfg),
  backupOpenFolder: () => ipcRenderer.invoke('backup-open-folder'),
  backupChangeFolder: () => ipcRenderer.invoke('backup-change-folder'),
  backupPickFolder: (title) => ipcRenderer.invoke('backup-pick-folder', title),
  backupTestDestination: (folderPath) => ipcRenderer.invoke('backup-test-destination', folderPath),
  backupTestGoogleDrive: (params) => ipcRenderer.invoke('backup-test-gdrive', params),
  backupDetectGoogleDrive: () => ipcRenderer.invoke('backup-detect-gdrive'),
  backupExportFile: (fileName) => ipcRenderer.invoke('backup-export-file', fileName),

  // PDF / Print
  printToPDF: (defaultName) => ipcRenderer.invoke('print-to-pdf', defaultName),
  exportPdfSilently: (fileName, targetFolder) => ipcRenderer.invoke('export-pdf-silently', fileName, targetFolder),
  printDirect: () => ipcRenderer.invoke('print-direct'),

  // ZKTeco Biometric Endpoints
  zkTestConnection: (options) => ipcRenderer.invoke('zk-test-connection', options),
  zkSyncAttendance: (options) => ipcRenderer.invoke('zk-sync-attendance', options),
  zkGetStats: () => ipcRenderer.invoke('zk-get-stats')
});
