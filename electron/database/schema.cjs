const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();

async function initializeSchema(db) {
  await db.exec('PRAGMA journal_mode = WAL');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      truckNumber TEXT,
      license TEXT,
      trailerNumber TEXT
    );
    CREATE TABLE IF NOT EXISTS master_materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT,
      defaultPrice REAL,
      unit TEXT
    );
    CREATE TABLE IF NOT EXISTS works_of (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS master_items (
      id TEXT PRIMARY KEY,
      worksOfId TEXT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS estimate_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS estimates (
      id TEXT PRIMARY KEY,
      date TEXT,
      desc TEXT,
      chassis TEXT,
      length TEXT,
      width TEXT,
      height TEXT,
      sellPrice REAL,
      totalCost REAL,
      profitPercentage REAL,
      categoryId TEXT,
      materials TEXT, 
      specs TEXT,
      attachments TEXT
    );
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      date TEXT,
      customerName TEXT,
      items TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      date TEXT,
      customerName TEXT,
      customerId TEXT,
      type TEXT,
      items TEXT,
      total REAL,
      discount REAL,
      netTotal REAL,
      notes TEXT,
      terms TEXT,
      createdBy TEXT
    );
    CREATE TABLE IF NOT EXISTS deleted_invoices (
      id TEXT PRIMARY KEY,
      date TEXT,
      customerName TEXT,
      customerId TEXT,
      type TEXT,
      items TEXT,
      total REAL,
      discount REAL,
      netTotal REAL,
      notes TEXT,
      terms TEXT,
      createdBy TEXT
    );
    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      date TEXT,
      to_name TEXT,
      subject TEXT,
      blocks TEXT,
      isArchived INTEGER DEFAULT 0,
      customerId TEXT,
      senderUserId TEXT,
      senderName TEXT,
      senderTitle TEXT,
      senderSignature TEXT,
      senderStamp TEXT,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS shipping_orders (
      id TEXT PRIMARY KEY,
      date TEXT,
      destination TEXT,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS store (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      date TEXT,
      supplierName TEXT,
      supplierId TEXT,
      invoiceNumber TEXT,
      items TEXT,
      total REAL,
      discount REAL,
      netTotal REAL,
      notes TEXT,
      attachments TEXT,
      status TEXT,
      createdBy TEXT,
      createdById TEXT
    );
  `);

    try { await db.exec("ALTER TABLE master_materials ADD COLUMN worksOfIds TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE purchase_invoices ADD COLUMN status TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE purchase_invoices ADD COLUMN createdBy TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE purchase_invoices ADD COLUMN createdById TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE invoices ADD COLUMN createdBy TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE deleted_invoices ADD COLUMN createdBy TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN customerId TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN senderUserId TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN senderName TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN senderTitle TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN senderSignature TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN senderStamp TEXT"); } catch(e) {}
    try { await db.exec("ALTER TABLE letters ADD COLUMN data TEXT"); } catch(e) {}
  try { await db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT)`); } catch(e) {}
  try { 
    await db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, timestamp TEXT, data TEXT)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC)`);
  } catch(e) {}
  // Add orderIndex column to works_of if not exists
  try {
    await db.exec('ALTER TABLE works_of ADD COLUMN orderIndex INTEGER DEFAULT 0');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add orderIndex column to master_items if not exists
  try {
    await db.exec('ALTER TABLE master_items ADD COLUMN orderIndex INTEGER DEFAULT 0');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add notes column to estimates if not exists
  try {
    await db.exec('ALTER TABLE estimates ADD COLUMN notes TEXT');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add lastUpdated column to estimates if not exists
  try {
    await db.exec('ALTER TABLE estimates ADD COLUMN lastUpdated TEXT');
  } catch (err) {
    // Column already exists, ignore
  }

  // ─── Human Resources (HR) & ZKTeco Tables ─────────────────────────────
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS hr_shifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        startTime TEXT NOT NULL DEFAULT '08:00',
        endTime TEXT NOT NULL DEFAULT '17:00',
        lateGraceMinutes INTEGER DEFAULT 10,
        earlyGraceMinutes INTEGER DEFAULT 10,
        isSplitShift INTEGER DEFAULT 0,
        splitBreakStart TEXT DEFAULT '13:00',
        splitBreakEnd TEXT DEFAULT '14:00',
        workHours REAL DEFAULT 8,
        workDays TEXT,
        color TEXT,
        isDefault INTEGER DEFAULT 0,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS hr_employees (
        id TEXT PRIMARY KEY,
        badgeNumber TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        ssn TEXT,
        deptId TEXT,
        deptName TEXT,
        jobTitle TEXT,
        shiftId TEXT,
        shiftIds TEXT,
        isZkLinked INTEGER DEFAULT 1,
        attendanceMode TEXT DEFAULT 'auto_present',
        salaryType TEXT DEFAULT 'monthly',
        basicSalary REAL DEFAULT 0,
        dailyRate REAL DEFAULT 0,
        hourlyRate REAL DEFAULT 0,
        overtimeMode TEXT DEFAULT 'general',
        overtimePercent REAL DEFAULT 125,
        overtimeFixedAmount REAL DEFAULT 0,
        hireDate TEXT,
        isActive INTEGER DEFAULT 1,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_hr_employees_badge ON hr_employees (badgeNumber);

      CREATE TABLE IF NOT EXISTS hr_attendance_logs (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        badgeNumber TEXT,
        checkTime TEXT NOT NULL,
        checkType TEXT,
        verifyCode TEXT,
        sn TEXT,
        source TEXT DEFAULT 'zkteco',
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_hr_att_user_time ON hr_attendance_logs (userId, checkTime);

      CREATE TABLE IF NOT EXISTS hr_transactions (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        employeeName TEXT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        month TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        createdBy TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_hr_trans_month ON hr_transactions (month, employeeId);

      CREATE TABLE IF NOT EXISTS hr_leaves (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        employeeName TEXT,
        type TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        hours REAL DEFAULT 0,
        reason TEXT,
        status TEXT DEFAULT 'approved',
        approvedBy TEXT
      );

      CREATE TABLE IF NOT EXISTS hr_payroll_records (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        generatedAt TEXT NOT NULL,
        data TEXT,
        totalNet REAL DEFAULT 0,
        totalDeductions REAL DEFAULT 0,
        totalAdditions REAL DEFAULT 0,
        isApproved INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS hr_settlements (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        employeeName TEXT NOT NULL,
        badgeNumber TEXT,
        deptName TEXT,
        jobTitle TEXT,
        settlementDate TEXT NOT NULL,
        month TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        reason TEXT NOT NULL,
        reasonDetails TEXT,
        salaryType TEXT,
        baseSalaryOrRate REAL DEFAULT 0,
        actualWorkDays REAL DEFAULT 0,
        absentDays REAL DEFAULT 0,
        earnedSalary REAL DEFAULT 0,
        overtimeHours REAL DEFAULT 0,
        overtimeAmount REAL DEFAULT 0,
        bonuses REAL DEFAULT 0,
        allowances REAL DEFAULT 0,
        leaveBalancePayout REAL DEFAULT 0,
        endOfServiceGratuity REAL DEFAULT 0,
        totalAdditions REAL DEFAULT 0,
        lateMinutes REAL DEFAULT 0,
        earlyMinutes REAL DEFAULT 0,
        delayDeduction REAL DEFAULT 0,
        advances REAL DEFAULT 0,
        deductions REAL DEFAULT 0,
        otherDeductions REAL DEFAULT 0,
        totalDeductions REAL DEFAULT 0,
        netPayable REAL DEFAULT 0,
        paymentMethod TEXT DEFAULT 'نقداً',
        payoutDate TEXT,
        notes TEXT,
        approvedAt TEXT,
        approvedBy TEXT,
        isSettled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS hr_overtime_records (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        employeeName TEXT,
        badgeNumber TEXT,
        date TEXT NOT NULL,
        periodType TEXT NOT NULL,
        periodLabel TEXT,
        punchRange TEXT,
        actualMinutes REAL DEFAULT 0,
        hours REAL DEFAULT 0,
        hourlyRate REAL DEFAULT 0,
        overtimeRate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        reason TEXT,
        rejectionReason TEXT,
        notes TEXT,
        reviewedBy TEXT,
        reviewedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_hr_ot_date ON hr_overtime_records (date, employeeId);

      -- Default Shift if empty
      INSERT OR IGNORE INTO hr_shifts (id, name, startTime, endTime, lateGraceMinutes, earlyGraceMinutes, workHours, isDefault, color)
      VALUES 
        ('shift-default', 'دوام كامل رئيسي', '08:00', '17:00', 10, 10, 8, 1, '#2563eb'),
        ('shift-morning', 'دوام صباحي', '08:00', '13:00', 10, 10, 5, 0, '#059669'),
        ('shift-evening', 'دوام مسائي', '14:00', '18:00', 10, 10, 4, 0, '#7c3aed');
    `);

    // Safe column migrations for HR tables
    try {
      await db.exec('ALTER TABLE hr_employees ADD COLUMN shiftIds TEXT;');
    } catch (_) {
      // Column already exists
    }
    try {
      await db.exec('ALTER TABLE hr_employees ADD COLUMN isZkLinked INTEGER DEFAULT 1;');
    } catch (_) {
      // Column already exists
    }
    try {
      await db.exec('ALTER TABLE hr_employees ADD COLUMN attendanceMode TEXT DEFAULT "auto_present";');
    } catch (_) {
      // Column already exists
    }
    try {
      await db.exec('ALTER TABLE hr_employees ADD COLUMN terminationDate TEXT;');
    } catch (_) {
      // Column already exists
    }
    try {
      await db.exec('ALTER TABLE hr_employees ADD COLUMN terminationReason TEXT;');
    } catch (_) {
      // Column already exists
    }
  } catch (hrErr) {
    console.error('Error creating HR tables:', hrErr.message);
  }
}

module.exports = { initializeSchema };
