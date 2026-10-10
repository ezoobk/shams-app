const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(process.env.APPDATA + '/shams-app/database.sqlite');
const tables = ['invoices', 'work_orders', 'shipping_orders', 'estimates'];
tables.forEach(table => {
  db.all('SELECT * FROM ' + table, (err, rows) => {
    if (err) return;
    rows.forEach(r => {
      let s = JSON.stringify(r);
      let match = s.match(/"x"\s*:\s*([^,}]+)/);
      if (match) {
        console.log('Found x in', table, r.id, match[0]);
      }
    });
  });
});
