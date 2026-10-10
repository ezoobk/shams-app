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

replaceLine(95, 'الاسم الكامل للمادة (مطلوب)');
replaceLine(96, 'الاسم المختصر');
replaceLine(97, 'الوحدة');
replaceLine(98, 'السعر (مطلوب)');
replaceLine(99, 'إضافة');
replaceLine(103, 'اختر أقسام العمل التي تنتمي إليها هذه المادة لتسهيل البحث عنها:');
replaceLine(132, 'الاسم الكامل للمادة');
replaceLine(133, 'الاسم المختصر');
replaceLine(134, 'الوحدة');
replaceLine(135, 'السعر الافتراضي');
replaceLine(151, 'حفظ');
replaceLine(152, 'إلغاء');
replaceLine(156, 'بأقسام العمل وتصنيف المادة');
replaceLine(157, 'تعديل المادة');
replaceLine(158, ['هل أنت متأكد من حذف هذه المادة؟', 'حذف المادة']);
replaceLine(167, ['ربط المادة', 'بأقسام العمل:']);
replaceLine(182, 'اختر الأقسام التي تريد أن تظهر فيها هذه المادة تلقائياً أو التي تنتمي إليها المادة. يمكنك فلترة المواد لاحقاً باستخدام هذا التصنيف.');
replaceLine(191, 'لا توجد مواد تطابق خيارات التصفية.');
replaceLine(200, 'لا توجد مواد تطابق خيارات التصفية.');
replaceLine(206, 'الاسم الكامل');
replaceLine(208, 'الاسم المختصر');
replaceLine(209, 'الوحدة');
replaceLine(211, 'السعر');
replaceLine(213, 'حفظ');
replaceLine(229, 'الوحدة:');
replaceLine(233, 'السعر الافتراضي:');
replaceLine(239, ['ربط بأقسام العمل', 'ربط']);
replaceLine(240, 'تعديل المادة');
replaceLine(241, ['هل أنت متأكد من حذف هذه المادة؟', 'حذف المادة']);
replaceLine(247, 'ربط بـ:');

fs.writeFileSync('src/views/Materials/MaterialsView.tsx', lines.join('\n'));
console.log('Fixed exactly by line!');
