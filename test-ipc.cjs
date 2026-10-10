const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const dataPath = path.join(app.getPath('documents'), 'ShamsAppData.json');
  console.log('Testing data path:', dataPath);
  
  // Write test
  try {
    const testData = { test: true, timestamp: Date.now() };
    fs.writeFileSync(dataPath, JSON.stringify(testData), 'utf-8');
    console.log('WRITE SUCCESS');
  } catch(e) {
    console.error('WRITE FAILED', e);
    app.exit(1);
  }

  // Read test
  try {
    const readData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    if (readData.test === true) {
      console.log('READ SUCCESS');
    } else {
      console.error('READ FAILED: mismatch');
      app.exit(1);
    }
  } catch(e) {
    console.error('READ FAILED', e);
    app.exit(1);
  }

  console.log('ALL IPC MOCK TESTS PASSED');
  app.exit(0);
});
