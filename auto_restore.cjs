const fs = require('fs');
const iconv = require('iconv-lite');

let content = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8');

// Replace all non-ASCII blocks
content = content.replace(/[^\x00-\x7F]+/g, (match) => {
  try {
    // encode the garbled UTF-8 string to cp437 bytes
    const buf = iconv.encode(match, 'cp437');
    // decode the bytes as valid utf8
    const restored = iconv.decode(buf, 'utf8');
    // check if it's valid (doesn't contain replacement characters)
    if (!restored.includes('')) {
      return restored;
    }
  } catch (e) {}
  return match;
});

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', content);
console.log('Restored using CP437 mapping!');
