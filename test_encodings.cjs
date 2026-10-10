const iconv = require('iconv-lite');
const str = '╪د┘„╪د╪│┘à';

const encodings = ['cp437', 'cp850', 'cp1252', 'latin1', 'macroman', 'cp866'];
for (const enc of encodings) {
  try {
    const buf = iconv.encode(str, enc);
    console.log(enc, '->', iconv.decode(buf, 'utf8'));
  } catch (e) {}
}
