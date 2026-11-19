/**
 * electron/zktecoBridge.cjs
 * 
 * جسر الربط مع قاعدة بيانات جهاز البصمة ZKTeco (att2000.mdb)
 * يعمل في وضع القراءة فقط (Mode=Read) لمنع أي تعارض مع برنامج البصمة.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_MDB_PATH = 'K:\\shams\\55\\ZKTeco\\att2000.mdb';
const DEFAULT_DEVICE_IP = '192.168.16.200';
const DEFAULT_DEVICE_PORT = 4370;

/**
 * تنفيذ أمر PowerShell وإرجاع النتيجة كـ JSON
 */
function runPowerShellScript(script, maxBuffer = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { maxBuffer, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`PowerShell Execution Error: ${err.message}\nStderr: ${stderr}`));
        }
        try {
          const trimmed = (stdout || '').trim();
          if (!trimmed) {
            return resolve(null);
          }
          const parsed = JSON.parse(trimmed);
          resolve(parsed);
        } catch (parseErr) {
          reject(new Error(`Failed to parse PowerShell output as JSON: ${parseErr.message}\nRaw Output: ${stdout.slice(0, 500)}`));
        }
      }
    );
  });
}

/**
 * فحص الاتصال بجهاز البصمة مباشرة عبر الشبكة (Ethernet IP:Port)
 */
async function testZkDeviceDirect(ip = DEFAULT_DEVICE_IP, port = DEFAULT_DEVICE_PORT) {
  const psScript = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $ip = "${ip}"
    $port = ${port}

    $zk = New-Object -ComObject "zkemkeeper.ZKEM"
    [void]$zk.SetCommPassword(0)

    $connected = $zk.Connect_Net($ip, $port)
    if (-not $connected) {
        $errCode = 0
        [void]$zk.GetLastError([ref]$errCode)
        @{
            success = $false
            error = "فشل الاتصال بجهاز البصمة عبر الشبكة ($($ip):$($port)). تأكد من تشغيل الجهاز وتوصيل كابل الشبكة. كود الخطأ: $errCode"
            ip = $ip
            port = $port
            connectionMode = "direct"
        } | ConvertTo-Json
        exit
    }

    try {
        $sn = ""
        [void]$zk.GetSerialNumber(1, [ref]$sn)
        $productCode = ""
        [void]$zk.GetProductCode(1, [ref]$productCode)
        $firmware = ""
        [void]$zk.GetFirmwareVersion(1, [ref]$firmware)
        
        # قراءة قائمة المستخدمين المسجلين فعلياً في الجهاز
        [void]$zk.ReadAllUserID(1)
        $enrollNumber = ""
        $name = ""
        $password = ""
        $privilege = 0
        $enabled = $false
        
        $userCount = 0
        while ($zk.SSR_GetAllUserInfo(1, [ref]$enrollNumber, [ref]$name, [ref]$password, [ref]$privilege, [ref]$enabled)) {
            $userCount++
        }

        $logCount = 0
        [void]$zk.GetDeviceStatus(1, 6, [ref]$logCount)

        @{
            success = $true
            ip = $ip
            port = $port
            serialNumber = $sn
            productCode = $productCode
            firmware = $firmware
            userCount = [int]$userCount
            logCount = [int]$logCount
            connectionMode = "direct"
        } | ConvertTo-Json
    } finally {
        [void]$zk.Disconnect()
    }
  `;

  try {
    const res = await runPowerShellScript(psScript);
    return res || { success: false, error: 'لم يتم استرجاع أي بيانات من فحص الجهاز', ip, port };
  } catch (e) {
    return { success: false, error: e.message, ip, port };
  }
}

/**
 * فحص الاتصال بقاعدة بيانات ZKTeco (سواء مباشر عبر الشبكة أو عبر ملف MDB)
 */
async function testZkConnection(targetOrOptions = DEFAULT_MDB_PATH) {
  let mode = 'file';
  let mdbPath = DEFAULT_MDB_PATH;
  let ip = DEFAULT_DEVICE_IP;
  let port = DEFAULT_DEVICE_PORT;

  if (typeof targetOrOptions === 'object' && targetOrOptions !== null) {
    mode = targetOrOptions.mode || (targetOrOptions.ip ? 'direct' : 'file');
    mdbPath = targetOrOptions.path || DEFAULT_MDB_PATH;
    ip = targetOrOptions.ip || DEFAULT_DEVICE_IP;
    port = Number(targetOrOptions.port) || DEFAULT_DEVICE_PORT;
  } else if (typeof targetOrOptions === 'string') {
    if (targetOrOptions.includes('.') && !targetOrOptions.includes('\\') && !targetOrOptions.includes('/')) {
      mode = 'direct';
      ip = targetOrOptions;
    } else {
      mdbPath = targetOrOptions;
    }
  }

  if (mode === 'direct') {
    return testZkDeviceDirect(ip, port);
  }

  if (!fs.existsSync(mdbPath)) {
    return {
      success: false,
      error: `ملف قاعدة بيانات البصمة غير موجود في المسار: ${mdbPath}`,
      path: mdbPath,
      connectionMode: 'file'
    };
  }

  const psScript = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $mdbPath = '${mdbPath.replace(/'/g, "''")}'
    try {
      $conn = New-Object -ComObject ADODB.Connection
      $conn.Open("Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$mdbPath;Mode=Read;Persist Security Info=False;")
      
      $rsUsers = $conn.Execute("SELECT COUNT(*) AS total FROM USERINFO")
      $userCount = $rsUsers.Fields.Item('total').Value
      
      $rsLogs = $conn.Execute("SELECT COUNT(*) AS total FROM CHECKINOUT")
      $logCount = $rsLogs.Fields.Item('total').Value

      $rsLast = $conn.Execute("SELECT TOP 1 CHECKTIME FROM CHECKINOUT ORDER BY CHECKTIME DESC")
      $lastLog = if (-not $rsLast.EOF) { [string]$rsLast.Fields.Item('CHECKTIME').Value } else { "" }

      $conn.Close()

      @{
        success = $true
        userCount = [int]$userCount
        logCount = [int]$logCount
        lastLogTime = $lastLog
        path = $mdbPath
        connectionMode = "file"
      } | ConvertTo-Json
    } catch {
      @{
        success = $false
        error = $_.Exception.Message
        path = $mdbPath
        connectionMode = "file"
      } | ConvertTo-Json
    }
  `;

  try {
    const res = await runPowerShellScript(psScript);
    return res || { success: false, error: 'لم يتم استرجاع أي بيانات من الفحص' };
  } catch (e) {
    return { success: false, error: e.message, path: mdbPath };
  }
}

/**
 * سحب البيانات مباشرة من جهاز البصمة عبر الشبكة (الموظفين والحركات)
 */
async function fetchZkDataDirect(ip = DEFAULT_DEVICE_IP, port = DEFAULT_DEVICE_PORT, options = {}) {
  const shouldReadUsers = !options.logsOnly || Boolean(options.syncEmployees || options.matchActiveOnly || options.purgeMissing);

  const psScript = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $ip = "${ip}"
    $port = ${port}

    $zk = New-Object -ComObject "zkemkeeper.ZKEM"
    [void]$zk.SetCommPassword(0)

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $connected = $zk.Connect_Net($ip, $port)

    if (-not $connected) {
        $errCode = 0
        [void]$zk.GetLastError([ref]$errCode)
        @{
            success = $false
            error = "فشل الاتصال بجهاز البصمة عبر الشبكة ($($ip):$($port)). كود الخطأ: $errCode"
            ip = $ip
            port = $port
        } | ConvertTo-Json
        exit
    }

    try {
        # 1. Device Info
        $sn = ""
        [void]$zk.GetSerialNumber(1, [ref]$sn)
        $productCode = ""
        [void]$zk.GetProductCode(1, [ref]$productCode)
        
        # 2. Read Users (only if needed or requested)
        $users = [System.Collections.Generic.List[object]]::new(100)
        $shouldReadUsers = ${shouldReadUsers ? '$true' : '$false'}
        if ($shouldReadUsers) {
            [void]$zk.ReadAllUserID(1)
            $userEnroll = ""
            $userName = ""
            $userPassword = ""
            $userPrivilege = 0
            $userEnabled = $false
            
            $enc1252 = [System.Text.Encoding]::GetEncoding(1252)
            $enc1256 = [System.Text.Encoding]::GetEncoding(1256)
            
            while ($zk.SSR_GetAllUserInfo(1, [ref]$userEnroll, [ref]$userName, [ref]$userPassword, [ref]$userPrivilege, [ref]$userEnabled)) {
                $cleanName = $userName
                try {
                    $bytes = $enc1252.GetBytes($userName)
                    $cleanName = $enc1256.GetString($bytes)
                } catch {}
                
                $users.Add(@{
                    id = [string]$userEnroll
                    badgeNumber = [string]$userEnroll
                    name = [string]$cleanName
                    privilege = [int]$userPrivilege
                    enabled = [bool]$userEnabled
                })
            }
        }
        
        # 3. Read Attendance Logs
        $logs = [System.Collections.Generic.List[object]]::new(500)
        if ($zk.ReadGeneralLogData(1)) {
            $logEnroll = ""
            $vMode = 0
            $ioMode = 0
            $y = 0; $m = 0; $d = 0; $h = 0; $min = 0; $s = 0; $wCode = 0
            
            $ssrWorked = $false
            try {
                while ($zk.SSR_GetGeneralLogData(1, [ref]$logEnroll, [ref]$vMode, [ref]$ioMode, [ref]$y, [ref]$m, [ref]$d, [ref]$h, [ref]$min, [ref]$s, [ref]$wCode)) {
                    $ssrWorked = $true
                    $timeStr = "{0:D4}-{1:D2}-{2:D2} {3:D2}:{4:D2}:{5:D2}" -f $y, $m, $d, $h, $min, $s
                    $logs.Add(@{
                        userId = [string]$logEnroll
                        badgeNumber = [string]$logEnroll
                        checkTime = [string]$timeStr
                        verifyCode = [string]$vMode
                        checkType = if ($ioMode -eq 1) { "O" } else { "I" }
                        sn = [string]$sn
                    })
                }
            } catch {
                if (-not $ssrWorked) {
                    $dwTMachineNumber = 0; $dwEnrollNumber = 0; $dwEMachineNumber = 0
                    while ($zk.GetGeneralLogData(1, [ref]$dwTMachineNumber, [ref]$dwEnrollNumber, [ref]$dwEMachineNumber, [ref]$vMode, [ref]$ioMode, [ref]$y, [ref]$m, [ref]$d, [ref]$h, [ref]$min, [ref]$s, [ref]$wCode)) {
                        $timeStr = "{0:D4}-{1:D2}-{2:D2} {3:D2}:{4:D2}:{5:D2}" -f $y, $m, $d, $h, $min, $s
                        $logs.Add(@{
                            userId = [string]$dwEnrollNumber
                            badgeNumber = [string]$dwEnrollNumber
                            checkTime = [string]$timeStr
                            verifyCode = [string]$vMode
                            checkType = if ($ioMode -eq 1) { "O" } else { "I" }
                            sn = [string]$sn
                        })
                    }
                }
            }
        }

        $sw.Stop()

        @{
            success = $true
            device = @{
                ip = $ip
                port = $port
                serialNumber = $sn
                productCode = $productCode
                userCount = $users.Count
                logCount = $logs.Count
                elapsedMs = $sw.ElapsedMilliseconds
            }
            users = $users
            logs = $logs
        } | ConvertTo-Json -Depth 4 -Compress
    } finally {
        [void]$zk.Disconnect()
    }
  `;

  return runPowerShellScript(psScript);
}

/**
 * مزامنة مباشرة من جهاز البصمة مع قاعدة بيانات SQLite
 */
async function syncZkDirectToDatabase(ip = DEFAULT_DEVICE_IP, port = DEFAULT_DEVICE_PORT, sqliteDb, options = {}) {
  if (!sqliteDb) {
    throw new Error('SQLite database instance is required for sync');
  }

  const zkData = await fetchZkDataDirect(ip, port, options);
  if (!zkData || !zkData.success) {
    throw new Error(zkData?.error || 'فشل سحب البيانات من جهاز البصمة');
  }

  // في حال سحب البصمات (الافتراضي)، لا يتم المساس بجدول الموظفين نهائياً
  // يتم تحديث أو مطابقة الموظفين فقط عند طلب ذلك صراحة عبر (syncEmployees أو matchActiveOnly أو purgeMissing)
  const shouldSyncEmployees = Boolean(options.syncEmployees || options.matchActiveOnly || options.purgeMissing) && !options.logsOnly;

  const { users = [], logs = [], device = {} } = zkData;
  let insertedLogsCount = 0;
  let upsertedUsersCount = 0;
  let purgedUsersCount = 0;
  let deactivatedUsersCount = 0;

  await sqliteDb.exec('BEGIN TRANSACTION');
  try {
    if (shouldSyncEmployees) {
      // 1. جمع قائمة أرقام البصمات النشطة فعلياً داخل الجهاز
      const activeBadgeSet = new Set();
      for (const u of users) {
        if (u.badgeNumber) {
          const raw = String(u.badgeNumber).trim();
          activeBadgeSet.add(raw);
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) {
            activeBadgeSet.add(String(parsed));
          }
        }
      }

      // 2. إذا طلب المستخدم مطابقة الموظفين النشطين فقط مع الجهاز
      if (options.matchActiveOnly || options.purgeMissing) {
        const allEmps = await sqliteDb.all('SELECT id, badgeNumber, name, isZkLinked FROM hr_employees');
        for (const emp of allEmps) {
          // استثناء الموظفين غير المربوطين بجهاز البصمة نهائياً من الحذف أو التعطيل
          if (emp.isZkLinked === 0 || emp.isZkLinked === false) {
            continue;
          }

          const badge = String(emp.badgeNumber || '').trim();
          const badgeNoZero = String(parseInt(badge, 10));

          const isInDevice = (badge && activeBadgeSet.has(badge)) || (badgeNoZero && activeBadgeSet.has(badgeNoZero));
          if (!isInDevice) {
            if (options.purgeMissing) {
              // حذف الموظف غير الموجود في الجهاز نهائياً
              await sqliteDb.run('DELETE FROM hr_employees WHERE id = ?', [emp.id]);
              purgedUsersCount++;
            } else {
              // إلغاء تفعيل الموظف فقط (أرشفة)
              await sqliteDb.run('UPDATE hr_employees SET isActive = 0 WHERE id = ?', [emp.id]);
              deactivatedUsersCount++;
            }
          }
        }
      }

      // 3. تحديث / إدراج الموظفين النشطين القادمين من الجهاز
      for (const u of users) {
        if (!u.id && !u.badgeNumber) continue;
        const rawBadge = String(u.badgeNumber || u.id).trim();
        const badgeNoZero = String(parseInt(rawBadge, 10));

        let existing = await sqliteDb.get(
          'SELECT id, name, deptName, jobTitle FROM hr_employees WHERE badgeNumber = ? OR badgeNumber = ? OR id = ?',
          [rawBadge, badgeNoZero, rawBadge]
        );

        if (existing) {
          await sqliteDb.run(`
            UPDATE hr_employees SET
              badgeNumber = ?,
              name = CASE 
                WHEN name IS NULL OR name = '' OR name = badgeNumber OR name LIKE 'موظف %' 
                THEN ? 
                ELSE name 
              END,
              isZkLinked = 1,
              isActive = 1
            WHERE id = ?
          `, [
            rawBadge,
            u.name || `موظف ${rawBadge}`,
            existing.id
          ]);
        } else {
          await sqliteDb.run(`
            INSERT INTO hr_employees (
              id, badgeNumber, name, salaryType, basicSalary, dailyRate, overtimeMode, overtimePercent, isZkLinked, attendanceMode, isActive
            ) VALUES (?, ?, ?, 'monthly', 0, 0, 'general', 125, 1, 'biometric', 1)
          `, [
            rawBadge,
            rawBadge,
            u.name || `موظف ${rawBadge}`
          ]);
        }
        upsertedUsersCount++;
      }
    }

    // 4. إدراج حركات البصمة القادمة من الجهاز (سحب البصمات)
    if (logs.length > 0) {
      const logStmt = await sqliteDb.prepare(`
        INSERT OR IGNORE INTO hr_attendance_logs (id, userId, badgeNumber, checkTime, checkType, verifyCode, sn, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'zkteco_direct')
      `);

      for (const l of logs) {
        if (!l.checkTime) continue;
        const logId = `ZK_${l.badgeNumber}_${l.checkTime.replace(/[- :]/g, '')}`;
        const result = await logStmt.run(
          logId,
          l.userId || l.badgeNumber,
          l.badgeNumber,
          l.checkTime,
          l.checkType || 'I',
          l.verifyCode || null,
          l.sn || device.serialNumber || null
        );
        if (result && result.changes > 0) {
          insertedLogsCount++;
        }
      }
      await logStmt.finalize();
    }

    // 5. حفظ إحصائيات المزامنة في جدول store
    const nowIso = new Date().toISOString();
    await sqliteDb.run(`
      INSERT INTO store (key, value) VALUES ('zk_last_sync', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [nowIso]);

    await sqliteDb.run(`
      INSERT INTO store (key, value) VALUES ('zk_sync_stats', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [JSON.stringify({
      lastSyncAt: nowIso,
      connectionMode: 'direct',
      ip,
      port,
      serialNumber: device.serialNumber,
      productCode: device.productCode,
      insertedLogsCount,
      activeUsersCount: users.length,
      purgedUsersCount,
      deactivatedUsersCount
    })]);

    await sqliteDb.exec('COMMIT');
  } catch (err) {
    await sqliteDb.exec('ROLLBACK');
    throw err;
  }

  return {
    success: true,
    connectionMode: 'direct',
    device,
    insertedLogsCount,
    upsertedUsersCount,
    purgedUsersCount,
    deactivatedUsersCount,
    activeUsersCount: users.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * سحب البيانات من ZKTeco (الموظفين، الورديات، والبصمات)
 * @param {string} mdbPath
 * @param {object} options { sinceDate, includeAllLogs }
 */
async function fetchZkData(mdbPath = DEFAULT_MDB_PATH, options = {}) {
  if (!fs.existsSync(mdbPath)) {
    throw new Error(`ملف قاعدة بيانات البصمة غير موجود: ${mdbPath}`);
  }

  const sinceDateFilter = options.sinceDate ? `WHERE c.CHECKTIME >= #${options.sinceDate}#` : '';
  const topClause = (!options.sinceDate && !options.includeAllLogs) ? 'TOP 5000' : '';

  const psScript = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $mdbPath = '${mdbPath.replace(/'/g, "''")}'
    try {
      $conn = New-Object -ComObject ADODB.Connection
      $conn.Open("Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$mdbPath;Mode=Read;Persist Security Info=False;")

      # 1. Users & Departments
      $rsUsers = $conn.Execute("SELECT u.USERID, u.Badgenumber, u.SSN, u.Name, u.Gender, u.TITLE, u.HIREDDAY, u.DEFAULTDEPTID, u.OPHONE, u.FPHONE, d.DEPTNAME FROM USERINFO u LEFT JOIN DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID")
      $users = [System.Collections.Generic.List[object]]::new(100)
      while (-not $rsUsers.EOF) {
        $users.Add(@{
          id = [string]$rsUsers.Fields.Item('USERID').Value
          badgeNumber = [string]$rsUsers.Fields.Item('Badgenumber').Value
          name = [string]$rsUsers.Fields.Item('Name').Value
          deptId = [string]$rsUsers.Fields.Item('DEFAULTDEPTID').Value
          deptName = [string]$rsUsers.Fields.Item('DEPTNAME').Value
          jobTitle = [string]$rsUsers.Fields.Item('TITLE').Value
          phone = [string]$rsUsers.Fields.Item('OPHONE').Value
          ssn = [string]$rsUsers.Fields.Item('SSN').Value
          hireDate = [string]$rsUsers.Fields.Item('HIREDDAY').Value
        })
        $rsUsers.MoveNext()
      }

      # 2. Shifts (SchClass)
      $rsShifts = $conn.Execute("SELECT schClassid, schName, StartTime, EndTime, LateMinutes, EarlyMinutes, WorkMins FROM SchClass")
      $shifts = [System.Collections.Generic.List[object]]::new(20)
      while (-not $rsShifts.EOF) {
        $stVal = $rsShifts.Fields.Item('StartTime').Value
        $etVal = $rsShifts.Fields.Item('EndTime').Value
        $stTime = if ($stVal) { ([datetime]$stVal).ToString('HH:mm') } else { '08:00' }
        $etTime = if ($etVal) { ([datetime]$etVal).ToString('HH:mm') } else { '17:00' }
        $rawLm = $rsShifts.Fields.Item('LateMinutes').Value
        $rawEm = $rsShifts.Fields.Item('EarlyMinutes').Value
        $rawWm = $rsShifts.Fields.Item('WorkMins').Value
        $lm = if ($rawLm -ne $null -and "$rawLm" -ne "") { [int]$rawLm } else { 10 }
        $em = if ($rawEm -ne $null -and "$rawEm" -ne "") { [int]$rawEm } else { 10 }
        $wm = if ($rawWm -ne $null -and "$rawWm" -ne "") { [int]$rawWm } else { 480 }
        $shifts.Add(@{
          id = [string]$rsShifts.Fields.Item('schClassid').Value
          name = [string]$rsShifts.Fields.Item('schName').Value
          startTime = $stTime
          endTime = $etTime
          lateGraceMinutes = $lm
          earlyGraceMinutes = $em
          workMins = $wm
        })
        $rsShifts.MoveNext()
      }

      # 3. Logs (Fast direct query on CHECKINOUT without heavy join)
      $logsQuery = "SELECT ${topClause} c.USERID, c.CHECKTIME, c.CHECKTYPE, c.VERIFYCODE, c.sn FROM CHECKINOUT c ${sinceDateFilter} ORDER BY c.CHECKTIME ASC"
      $rsLogs = $conn.Execute($logsQuery)
      $logs = [System.Collections.Generic.List[object]]::new(5000)
      while (-not $rsLogs.EOF) {
        $cVal = $rsLogs.Fields.Item('CHECKTIME').Value
        $isoTime = if ($cVal) { ([datetime]$cVal).ToString('yyyy-MM-dd HH:mm:ss') } else { '' }
        $logs.Add(@{
          userId = [string]$rsLogs.Fields.Item('USERID').Value
          checkTime = $isoTime
          checkType = [string]$rsLogs.Fields.Item('CHECKTYPE').Value
          verifyCode = [string]$rsLogs.Fields.Item('VERIFYCODE').Value
          sn = [string]$rsLogs.Fields.Item('sn').Value
        })
        $rsLogs.MoveNext()
      }

      $conn.Close()

      @{
        success = $true
        users = $users
        shifts = $shifts
        logs = $logs
      } | ConvertTo-Json -Depth 4 -Compress
    } catch {
      @{
        success = $false
        error = $_.Exception.Message
      } | ConvertTo-Json
    }
  `;

  const parsed = await runPowerShellScript(psScript);
  if (parsed && parsed.success && Array.isArray(parsed.logs) && Array.isArray(parsed.users)) {
    // ربط badgeNumber في Node.js بسرعة فائقة بدلاً من JOIN الثقيل في Access
    const userBadgeMap = new Map();
    for (const u of parsed.users) {
      if (u.id) {
        userBadgeMap.set(String(u.id), String(u.badgeNumber || u.id));
      }
    }
    for (const l of parsed.logs) {
      if (!l.badgeNumber && l.userId) {
        l.badgeNumber = userBadgeMap.get(String(l.userId)) || String(l.userId);
      }
    }
  }

  return parsed;
}

/**
 * مزامنة كاملة أو تدريجية مع قاعدة بيانات SQLite
 */
async function syncZkToDatabase(mdbPath = DEFAULT_MDB_PATH, sqliteDb, options = {}) {
  if (!sqliteDb) {
    throw new Error('SQLite database instance is required for sync');
  }

  // 1. استخراج تاريخ آخر مزامنة
  let sinceDate = options.sinceDate || null;
  if (!sinceDate && !options.fullSync) {
    try {
      const lastRow = await sqliteDb.get('SELECT MAX(checkTime) as maxTime FROM hr_attendance_logs');
      if (lastRow && lastRow.maxTime) {
        const d = new Date(lastRow.maxTime);
        const now = new Date();
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);

        // إذا كان آخر سجل حديثاً (خلال آخر 90 يوم)، نبدأ منه
        if (!isNaN(d.getTime()) && diffDays >= 0 && diffDays <= 90) {
          d.setMinutes(d.getMinutes() - 2);
          const pad = (n) => String(n).padStart(2, '0');
          sinceDate = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }
      }

      // إذا لم يكن هناك تاريخ مزامنة صالح أو كان قديماً جداً (أكثر من 90 يوم)
      if (!sinceDate) {
        // افتراضياً نسحب آخر 60 يوماً من الحضور لتكون سريعة جداً وتغطي الشهر الحالي والسابق
        const d = new Date();
        d.setDate(d.getDate() - 60);
        d.setHours(0, 0, 0, 0);
        const pad = (n) => String(n).padStart(2, '0');
        sinceDate = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} 00:00:00`;
      }
    } catch (e) {
      console.warn('Could not determine last sync date, performing standard fetch:', e.message);
    }
  }

  // 2. سحب البيانات من ZKTeco
  const zkData = await fetchZkData(mdbPath, {
    sinceDate: options.fullSync ? null : sinceDate,
    includeAllLogs: options.fullSync ? true : false
  });

  if (!zkData || !zkData.success) {
    throw new Error(zkData?.error || 'فشل سحب البيانات من ZKTeco');
  }

  const { users = [], shifts = [], logs = [] } = zkData;
  let insertedLogsCount = 0;
  let upsertedUsersCount = 0;

  // لا يتم المساس بالموظفين أو الورديات إلا إذا طُلب ذلك صراحة (syncEmployees)
  const shouldSyncEmployees = Boolean(options.syncEmployees || options.matchActiveOnly) && !options.logsOnly;

  // 3. كتابة البيانات في SQLite داخل معاملة موحدة
  await sqliteDb.exec('BEGIN TRANSACTION');
  try {
    if (shouldSyncEmployees) {
      // أ. مزامنة الورديات (إذا لم تكن معرفة من قبل)
      for (const sh of shifts) {
        const existing = await sqliteDb.get('SELECT id FROM hr_shifts WHERE id = ?', [sh.id]);
        if (!existing) {
          await sqliteDb.run(`
            INSERT INTO hr_shifts (id, name, startTime, endTime, lateGraceMinutes, earlyGraceMinutes, workHours, isDefault)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            sh.id,
            sh.name || `وردية ${sh.id}`,
            sh.startTime || '08:00',
            sh.endTime || '17:00',
            sh.lateGraceMinutes || 10,
            sh.earlyGraceMinutes || 10,
            sh.workMins ? Math.round((sh.workMins / 60) * 10) / 10 : 8,
            sh.id === '5' || sh.name.includes('اساسي') ? 1 : 0
          ]);
        }
      }

      // ب. مزامنة الموظفين
      for (const u of users) {
        if (!u.id) continue;
        const rawBadge = u.badgeNumber !== undefined && u.badgeNumber !== null ? String(u.badgeNumber).trim() : '';
        const badge = rawBadge || String(u.id).trim();

        // البحث عن الموظف بالكود (badgeNumber) أو بالمعرف (id)
        let existing = null;
        if (badge) {
          existing = await sqliteDb.get(
            'SELECT id, name, deptName, jobTitle FROM hr_employees WHERE badgeNumber = ?',
            [badge]
          );
        }
        if (!existing) {
          existing = await sqliteDb.get(
            'SELECT id, name, deptName, jobTitle FROM hr_employees WHERE id = ?',
            [String(u.id)]
          );
        }

        if (existing) {
          // تحديث الموظف الحالي دون تغيير مفتاحه الأساسي ودون الإخلال بالقيد الفريد
          await sqliteDb.run(`
            UPDATE hr_employees SET
              badgeNumber = ?,
              name = CASE 
                WHEN name IS NULL OR name = '' OR name = badgeNumber OR name LIKE 'موظف %' 
                THEN ? 
                ELSE name 
              END,
              deptId = COALESCE(?, deptId),
              deptName = CASE WHEN deptName IS NULL OR deptName = '' THEN ? ELSE deptName END,
              jobTitle = CASE WHEN jobTitle IS NULL OR jobTitle = '' THEN ? ELSE jobTitle END,
              phone = COALESCE(?, phone),
              ssn = COALESCE(?, ssn),
              hireDate = COALESCE(?, hireDate)
            WHERE id = ?
          `, [
            badge,
            u.name || `موظف ${badge}`,
            u.deptId || null,
            u.deptName || null,
            u.jobTitle || null,
            u.phone || null,
            u.ssn || null,
            u.hireDate || null,
            existing.id
          ]);
        } else {
          // إدراج موظف جديد
          await sqliteDb.run(`
            INSERT INTO hr_employees (
              id, badgeNumber, name, phone, ssn, deptId, deptName, jobTitle,
              hireDate, salaryType, basicSalary, dailyRate, overtimeMode, overtimePercent, isZkLinked, attendanceMode, isActive
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', 0, 0, 'general', 125, 1, 'biometric', 1)
          `, [
            String(u.id),
            badge,
            u.name || `موظف ${badge}`,
            u.phone || null,
            u.ssn || null,
            u.deptId || null,
            u.deptName || null,
            u.jobTitle || null,
            u.hireDate || null
          ]);
        }
        upsertedUsersCount++;
      }
    }

    // ج. مزامنة حركات البصمات
    const logStmt = await sqliteDb.prepare(`
      INSERT OR IGNORE INTO hr_attendance_logs (id, userId, badgeNumber, checkTime, checkType, verifyCode, sn, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'zkteco')
    `);

    for (const l of logs) {
      if (!l.userId || !l.checkTime) continue;
      // توليد معرف فريد يعتمد على userId والتوقيت الدقيق
      const logId = `ZK_${l.userId}_${l.checkTime.replace(/[- :]/g, '')}`;
      const result = await logStmt.run(
        logId,
        l.userId,
        l.badgeNumber || null,
        l.checkTime,
        l.checkType || 'I',
        l.verifyCode || null,
        l.sn || null
      );
      if (result && result.changes > 0) {
        insertedLogsCount++;
      }
    }
    await logStmt.finalize();

    // د. تحديث بيانات المزامنة في جدول store
    const nowIso = new Date().toISOString();
    await sqliteDb.run(`
      INSERT INTO store (key, value) VALUES ('zk_last_sync', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [nowIso]);

    await sqliteDb.run(`
      INSERT INTO store (key, value) VALUES ('zk_sync_stats', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [JSON.stringify({
      lastSyncAt: nowIso,
      insertedLogsCount,
      usersCount: users.length,
      path: mdbPath
    })]);

    await sqliteDb.exec('COMMIT');
  } catch (err) {
    await sqliteDb.exec('ROLLBACK');
    throw err;
  }

  return {
    success: true,
    insertedLogsCount,
    upsertedUsersCount,
    totalUsers: users.length,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_MDB_PATH,
  DEFAULT_DEVICE_IP,
  DEFAULT_DEVICE_PORT,
  testZkConnection,
  testZkDeviceDirect,
  fetchZkDataDirect,
  fetchZkData,
  syncZkDirectToDatabase,
  syncZkToDatabase
};
