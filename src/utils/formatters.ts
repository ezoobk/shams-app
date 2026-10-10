export const formatCurrency = (amount: any) => {
  return new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD' }).format(amount || 0);
};

export const parseDateSafely = (dateVal: any) => {
  if (!dateVal) return new Date();
  let d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  d = new Date(Number(dateVal));
  if (!isNaN(d.getTime())) return d;
  return new Date();
};


export const numberToArabicWords = (number: any) => {
  if (number === 0) return 'صفر دينار ليبي';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  const convertGroup = (num: any) => {
    let str = '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;

    if (h > 0) str += hundreds[h] + ' و';
    if (t === 1 && o > 0) {
      const teens = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
      str += teens[o] + ' و';
    } else {
      if (o > 0) str += ones[o] + ' و';
      if (t > 0 && t !== 1) str += tens[t] + ' و';
    }
    return str.slice(0, -2);
  };

  const [intPart, decPart] = Number(number).toFixed(2).split('.');
  let numInt = parseInt(intPart, 10);
  let result = '';

  if (numInt === 0) {
    result = '';
  } else if (numInt < 1000) {
    result = convertGroup(numInt);
  } else if (numInt < 1000000) {
    const th = Math.floor(numInt / 1000);
    const rem = numInt % 1000;
    let thStr = '';
    if (th === 1) thStr = 'ألف';
    else if (th === 2) thStr = 'ألفان';
    else if (th >= 3 && th <= 10) thStr = convertGroup(th) + ' آلاف';
    else thStr = convertGroup(th) + ' ألف';

    result = thStr + (rem > 0 ? ' و' + convertGroup(rem) : '');
  } else {
    const m = Math.floor(numInt / 1000000);
    const rem = numInt % 1000000;
    let mStr = '';
    if (m === 1) mStr = 'مليون';
    else if (m === 2) mStr = 'مليونان';
    else if (m >= 3 && m <= 10) mStr = convertGroup(m) + ' ملايين';
    else mStr = convertGroup(m) + ' مليون';
    result = mStr + (rem > 0 ? ' و' + numberToArabicWords(rem).replace(' دينار ليبي', '').replace('فقط ', '').replace(' لا غير', '') : '');
    return `فقط ${result.trim()} دينار ليبي لا غير`;
  }

  const numDec = parseInt(decPart, 10);
  let decStr = numDec > 0 ? ` و${convertGroup(numDec)} درهم` : '';
  return `فقط ${result.trim()} دينار ليبي${decStr} لا غير`.replace('  ', ' ');
};
