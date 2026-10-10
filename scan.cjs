const sqlite3 = require('sqlite3');
const fs = require('fs');
let appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share');
let p = appData + '/shams-app/database.sqlite';
const db = new sqlite3.Database(p);
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err || !tables) return;
  tables.forEach(t => {
    db.all("SELECT * FROM " + t.name, (err, rows) => {
      if (err || !rows) return;
      rows.forEach(r => {
        let s = JSON.stringify(r);
        if (s.includes('"x":') || s.includes('"y":')) {
          console.log('Found in', t.name, r.id);
        }
      });
    });
  });
});
