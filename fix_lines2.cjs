const fs = require('fs');
let lines = fs.readFileSync('src/views/Materials/MaterialsView.tsx', 'utf8').split('\n');

const replaceLine = (num, correct) => {
  if (Array.isArray(correct)) {
    let i = 0;
    lines[num] = lines[num].replace(/[^\x00-\x7F]+/g, () => correct[i++]);
  } else {
    lines[num] = lines[num].replace(/[^\x00-\x7F]+/g, correct);
  }
};

replaceLine(58, 'ليس لديك صلاحية لإضافة مادة');
replaceLine(75, 'ليس لديك صلاحية للتعديل');
replaceLine(84, 'إدارة المواد الخام');
replaceLine(86, 'عرض كجدول');
replaceLine(87, 'عرض كبطاقات');
replaceLine(91, 'بحث عن مادة...');
replaceLine(145, 'اختياري');
replaceLine(247, 'ربط بـ:'); // just in case

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', lines.join('\n'));
console.log('Fixed more by line!');
