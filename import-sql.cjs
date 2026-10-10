/**
 * استيراد بيانات من ملف SQL خارجي إلى قاعدة البيانات
 * طريقة الاستخدام:
 * node import-sql.cjs path/to/your-file.sql
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { initDatabase } = require('./electron/database/index.cjs');

async function runImport() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('❌ يرجى توفير مسار ملف SQL.');
    console.error('مثال: node import-sql.cjs C:/path/to/data.sql');
    process.exit(1);
  }

  const absolutePath = path.resolve(sqlFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ الملف غير موجود: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`⏳ جاري قراءة الملف: ${absolutePath}`);
  const sqlContent = fs.readFileSync(absolutePath, 'utf8');

  // مجلد قاعدة البيانات الافتراضي (يمكن تغييره إذا كان في الشبكة)
  const dbFolder = path.join(os.homedir(), 'Documents', 'ShamsAppData');
  console.log(`🔌 جاري الاتصال بقاعدة البيانات في: ${dbFolder}`);
  
  try {
    const db = await initDatabase(dbFolder);
    
    console.log(`⚙️ جاري تنفيذ أوامر SQL... الرجاء الانتظار.`);
    
    // تنفيذ السكريبت بالكامل (يدعم أوامر متعددة مفصولة بفاصلة منقوطة)
    await db.exec(sqlContent);
    
    console.log('✅ تم استيراد البيانات بنجاح!');
  } catch (err) {
    console.error('❌ حدث خطأ أثناء الاستيراد:', err.message);
  }
}

runImport();
