const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * إنشاء رمز وصول Google OAuth2 Access Token باستخدام حساب الخدمة (Service Account)
 */
async function getGoogleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`فشل الاتصال بجوجل OAuth2 (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/**
 * فحص الاتصال بحساب Google Drive
 */
async function testGoogleDriveConnection(clientEmail, privateKey, folderId = null) {
  try {
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (folderId && folderId.trim()) {
      const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId.trim())}?fields=id,name`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!folderRes.ok) {
        throw new Error('تم الاتصال بحساب الخدمة بنجاح، ولكن معرف المجلد (Folder ID) غير موجود أو يحتاج لمشاركته مع بريد حساب الخدمة.');
      }
      const folderData = await folderRes.json();
      return { success: true, message: `تم الاتصال بنجاح! تم التحقق من مجلد: "${folderData.name}"` };
    }
    return { success: true, message: 'تم الاتصال بحساب Google Drive بنجاح والتحقق من الصلاحيات!' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * رفع ملف النسخة الاحتياطية إلى Google Drive
 */
async function uploadFileToGoogleDrive(filePath, fileName, clientEmail, privateKey, folderId = null) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ملف النسخة الاحتياطية غير موجود: ${filePath}`);
  }

  const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;

  const metadata = {
    name: fileName,
    mimeType: 'application/x-sqlite3'
  };
  if (folderId && folderId.trim()) {
    metadata.parents = [folderId.trim()];
  }

  // 1. بدء جلسة الرفع القابلة للاستئناف (Resumable Upload)
  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/x-sqlite3',
      'X-Upload-Content-Length': fileSize.toString()
    },
    body: JSON.stringify(metadata)
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`خطأ في بدء رفع الملف إلى Google Drive: ${errText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('لم يقم Google Drive بإرجاع رابط الرفع.');
  }

  // 2. تدفق بيانات الملف إلى رابط الرفع
  const fileStream = fs.createReadStream(filePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': 'application/x-sqlite3'
    },
    body: fileStream,
    duplex: 'half'
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`فشل رفع ملف النسخة الاحتياطية إلى Google Drive (${uploadRes.status}): ${errText}`);
  }

  const uploadedData = await uploadRes.json();
  console.log(`[GoogleDrive] Backup uploaded successfully: ${fileName} (Drive ID: ${uploadedData.id})`);

  return {
    success: true,
    fileId: uploadedData.id,
    fileName: uploadedData.name,
    uploadedAt: new Date().toISOString()
  };
}

/**
 * الكشف التلقائي عن مسارات مجلدات Google Drive المثبتة على جهاز الويندوز
 */
function detectLocalGoogleDrivePaths() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const possiblePaths = [
    'G:\\My Drive',
    'G:\\',
    'H:\\My Drive',
    'H:\\',
    path.join(home, 'Google Drive'),
    path.join(home, 'My Drive'),
    path.join(home, 'Google Drive\\My Drive')
  ];

  const found = [];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        found.push(p);
      }
    } catch (e) {}
  }
  return found;
}

module.exports = {
  getGoogleAccessToken,
  testGoogleDriveConnection,
  uploadFileToGoogleDrive,
  detectLocalGoogleDrivePaths
};
