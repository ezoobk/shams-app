const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'Documents', 'ShamsAppData_dev', 'ShamsDatabase.sqlite');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, data FROM users', (err, rows) => {
  rows.forEach(r => {
    try {
      const d = JSON.parse(r.data);
      console.log(r.id, 'name:', d.displayName, 'job:', d.jobTitle, 'hasSig:', !!d.signature, 'hasStamp:', !!d.stamp);
    } catch (e) {
      console.log(r.id, 'err', e.message);
    }
  });
  db.close();
});
