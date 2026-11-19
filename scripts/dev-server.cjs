const path = require('path');
const os = require('os');
const { initDatabase } = require('../electron/database/index.cjs');
const { createApiServer } = require('../electron/server.cjs');

async function start() {
  process.env.SERVER_PORT = '3112';
  const devFolder = path.join(os.homedir(), 'Documents', 'ShamsAppData_dev');
  console.log('[Dev Server] Using isolated dev database folder:', devFolder);
  await initDatabase(devFolder);
  const server = await createApiServer();
  console.log('[Dev Server] Dev API Server is ready on port 3112');
  return server;
}

if (require.main === module) {
  start().catch(err => {
    if (err.code === 'EADDRINUSE') {
      console.log('[Dev Server] Port 3112 is already active.');
    } else {
      console.error('[Dev Server] Failed to start:', err);
    }
  });
}

module.exports = { start };
