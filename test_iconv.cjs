const iconv = require('iconv-lite');
const str = '╪د┘„┘ê╪ص╪»╪ر';
console.log('cp437:', iconv.decode(iconv.encode(str, 'cp437'), 'utf8'));
console.log('cp850:', iconv.decode(iconv.encode(str, 'cp850'), 'utf8'));
