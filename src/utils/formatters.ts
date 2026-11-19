export const formatCurrency = (amount: any): string => {
  if (amount === null || amount === undefined || amount === '') return '0.00';
  const num = Number(amount);
  if (isNaN(num)) return '0.00';

  // Check if there is a 3rd decimal digit to preserve it (e.g. 10.125), otherwise standard 2 decimal places
  const hasThirdDecimal = Math.abs(Math.round(num * 1000)) % 10 !== 0;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: hasThirdDecimal ? 3 : 2,
  }).format(num);
};

export const parseDateSafely = (dateVal: any): Date => {
  if (!dateVal) return new Date(0);
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? new Date(0) : dateVal;

  if (typeof dateVal === 'string') {
    const dmyMatch = dateVal.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmyMatch) {
      const [, day, month, year, h = '0', m = '0', s = '0'] = dmyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s));
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return d;
  }

  const num = Number(dateVal);
  if (!isNaN(num) && num > 0) {
    const d = new Date(Math.floor(num));
    if (!isNaN(d.getTime())) return d;
  }

  return new Date(0);
};


export const numberToArabicWords = (number: any) => {
  if (number === 0 || number === '0') return 'صفر دينار ليبي';
  if (number === null || number === undefined || isNaN(Number(number))) return '';

  const numVal = Number(number);
  if (numVal === 0) return 'صفر دينار ليبي';

  const isNegative = numVal < 0;
  const absVal = Math.abs(numVal);

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const teens = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];

  const convertGroup = (num: number): string => {
    let str = '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;

    if (h > 0) str += hundreds[h] + ' و';

    if (t === 1) {
      if (o === 0) {
        str += tens[1] + ' و';
      } else {
        str += teens[o] + ' و';
      }
    } else {
      if (o > 0) str += ones[o] + ' و';
      if (t > 1) str += tens[t] + ' و';
    }

    return str.endsWith(' و') ? str.slice(0, -2) : str;
  };

  const convertNumber = (numInt: number): string => {
    if (numInt === 0) return '';
    if (numInt < 1000) return convertGroup(numInt);

    if (numInt < 1000000) {
      const th = Math.floor(numInt / 1000);
      const rem = numInt % 1000;
      let thStr = '';
      if (th === 1) thStr = 'ألف';
      else if (th === 2) thStr = 'ألفان';
      else if (th >= 3 && th <= 10) thStr = convertGroup(th) + ' آلاف';
      else thStr = convertNumber(th) + ' ألف';

      return thStr + (rem > 0 ? ' و' + convertGroup(rem) : '');
    }

    if (numInt < 1000000000) {
      const m = Math.floor(numInt / 1000000);
      const rem = numInt % 1000000;
      let mStr = '';
      if (m === 1) mStr = 'مليون';
      else if (m === 2) mStr = 'مليونان';
      else if (m >= 3 && m <= 10) mStr = convertGroup(m) + ' ملايين';
      else mStr = convertNumber(m) + ' مليون';

      return mStr + (rem > 0 ? ' و' + convertNumber(rem) : '');
    }

    const b = Math.floor(numInt / 1000000000);
    const rem = numInt % 1000000000;
    let bStr = '';
    if (b === 1) bStr = 'مليار';
    else if (b === 2) bStr = 'ملياران';
    else if (b >= 3 && b <= 10) bStr = convertGroup(b) + ' مليارات';
    else bStr = convertNumber(b) + ' مليار';

    return bStr + (rem > 0 ? ' و' + convertNumber(rem) : '');
  };

  const [intPart, decPart] = absVal.toFixed(3).split('.');
  const numInt = parseInt(intPart, 10);
  const numDec = parseInt(decPart, 10);

  const intWords = convertNumber(numInt);
  let decWords = '';
  if (numDec > 0) {
    decWords = convertNumber(numDec) + ' درهم';
  }

  let fullWords = '';
  if (intWords && decWords) {
    fullWords = `${intWords} دينار ليبي و${decWords}`;
  } else if (intWords) {
    fullWords = `${intWords} دينار ليبي`;
  } else if (decWords) {
    fullWords = decWords;
  } else {
    fullWords = 'صفر دينار ليبي';
  }

  const prefix = isNegative ? 'سالب ' : '';
  return `فقط ${prefix}${fullWords.trim()} لا غير`.replace(/\s+/g, ' ');
};

/**
 * Calculates calendar-day duration between a start date and an end date (minimum 0).
 * Returns null if either date is missing or invalid.
 */
export const calculateDurationDays = (startDateVal: any, endDateVal: any): number | null => {
  if (!startDateVal || !endDateVal) return null;
  const start = parseDateSafely(startDateVal);
  const end = parseDateSafely(endDateVal);
  if (start.getTime() <= 0 || end.getTime() <= 0) return null;

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Formats a day count in clear Arabic (e.g. "0 يوم (نفس اليوم)", "يوم واحد", "يومان", "5 أيام", "12 يوم").
 */
export const formatDurationDaysAr = (days: number | null): string => {
  if (days === null || isNaN(days)) return '';
  if (days === 0) return '0 يوم (نفس اليوم)';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يوم`;
};
