const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/User/AppData/Local/shams-app/database.sqlite');
db.all(SELECT name FROM sqlite_master WHERE type='table', (err, tables) => {
  if (!tables) return;
  tables.forEach(t => {
    db.all(SELECT * FROM \"\$(	.name)\"\`, (err, rows) => {
      if (!rows) return;
      rows.forEach(r => {
        const str = JSON.stringify(r);
        if (str.match(/\"[xy]\":/i)) {
          console.log('FOUND in table', t.name, 'id:', r.id);
          // console.log(str.substring(0, 200));
        }
      });
    });
  });
});
