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
      terms TEXT
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
      terms TEXT
    );
    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      date TEXT,
      to_name TEXT,
      subject TEXT,
      blocks TEXT,
      isArchived INTEGER DEFAULT 0
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
  `);

    try { await db.exec("ALTER TABLE master_materials ADD COLUMN worksOfIds TEXT"); } catch(e) {}
  try { await db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT)`); } catch(e) {}
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
}

module.exports = { initializeSchema };
