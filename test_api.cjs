const http = require('http');

http.get('http://127.0.0.1:3112/api/collection/master_materials', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Success!', parsed.slice(0, 2));
    } catch(e) {
      console.log('Error parsing JSON', e.message);
    }
  });
}).on('error', (e) => {
  console.log('Error connecting', e.message);
});
