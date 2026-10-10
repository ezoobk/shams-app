const { app } = require('electron');
app.whenReady().then(() => {
  const path = require('path');
  console.log('DOCUMENTS PATH:', app.getPath('documents'));
  console.log('USER DATA PATH:', app.getPath('userData'));
  app.quit();
});
