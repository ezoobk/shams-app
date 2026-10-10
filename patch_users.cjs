const fs = require('fs');

function patchFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add 'users' to hydrateRows
  if (!c.includes(`table === 'users'`)) {
    c = c.replace(
      `} else if (table === 'shipping_orders') {`,
      `} else if (table === 'users') {
      return parseJSON(row.data) || row;
    } else if (table === 'shipping_orders') {`
    );
  }
  
  // 2. Add 'users' to bulk-upsert
  if (!c.includes(`case 'users':`)) {
    c = c.replace(
      `case 'shipping_orders':`,
      `case 'users':
            stmt = await db.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)');
            for (const u of items) await stmt.run(u.id, JSON.stringify(u));
            break;
          case 'shipping_orders':`
    );
  }
  
  fs.writeFileSync(filePath, c);
}

patchFile('electron/server.cjs');
patchFile('electron/database/ipcHandlers.cjs');
console.log('Backend patched for users!');
