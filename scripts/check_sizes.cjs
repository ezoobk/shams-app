const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:/Users/User/Documents/سجل الصادر/ShamsDatabase.sqlite';
const db = new sqlite3.Database(dbPath);

async function run() {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", async (err, tables) => {
    if (err) { console.error('Error fetching tables:', err); return; }
    console.log('Found tables:', tables.map(t => t.name));
    for (const t of tables) {
      const name = t.name;
      await new Promise(resolve => {
        db.all(`PRAGMA table_info("${name}")`, (err, cols) => {
          if (!cols || cols.length === 0) return resolve();
          const sumCols = cols.map(c => `coalesce(length("${c.name}"), 0)`).join(' + ');
          db.get(`SELECT count(*) as count, sum(${sumCols}) as total_bytes FROM "${name}"`, (err, res) => {
            if (!err && res) {
              const mb = (Number(res.total_bytes || 0) / 1024 / 1024).toFixed(3);
              console.log(`${name.padEnd(25)}: ${String(res.count).padStart(5)} rows, ${mb} MB`);
            } else if (err) {
              console.error(name, err.message);
            }
            resolve();
          });
        });
      });
    }
    db.close();
  });
}
run();
