const fs = require('fs');
let content = fs.readFileSync('./electron/main.cjs', 'utf8');

const newImports = "const { initDatabase } = require('./database/index.cjs');\nconst { registerIpcHandlers } = require('./database/ipcHandlers.cjs');";
content = content.replace("const fs = require('fs');", "const fs = require('fs');\n" + newImports);

content = content.replace("app.whenReady().then(() => {", "app.whenReady().then(async () => {\n  const dbFolderPath = app.isPackaged ? path.dirname(dataPath) : path.join(app.getPath('documents'), 'ShamsAppData');\n  await initDatabase(dbFolderPath);\n  registerIpcHandlers();\n");

// Remove read-data-sync and write-data-sync
content = content.replace(/ipcMain\.on\('read-data-sync'[\s\S]*?\}\);\n/m, '');
content = content.replace(/ipcMain\.on\('write-data-sync'[\s\S]*?\}\);\n/m, '');

fs.writeFileSync('./electron/main.cjs', content);
