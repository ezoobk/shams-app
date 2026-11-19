const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { initializeSchema } = require('./schema.cjs');
const { runMigrationIfNeeded } = require('./migration.cjs');

let db = null;
let currentDbFolder = null;
let currentDbPath = null;
let migrationDidRun = false;

// Global event emitter to notify HTTP and IPC clients of changes
const dbEvents = new EventEmitter();

async function initDatabase(folderPath) {
  currentDbFolder = folderPath;
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const dbPath = path.join(folderPath, 'ShamsDatabase.sqlite');
  currentDbPath = dbPath;
  const jsonPath = path.join(folderPath, 'ShamsAppData.json');
  
  // Create or open DB asynchronously
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Create tables if they don't exist
  await initializeSchema(db);
  
  // Run migration from JSON to DB if ShamsAppData.json exists
  migrationDidRun = await runMigrationIfNeeded(db, jsonPath);

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function getDbFolder() {
  return currentDbFolder;
}

function getDbPath() {
  return currentDbPath;
}

async function closeDatabase() {
  if (db) {
    try {
      await db.close();
    } catch (e) {
      console.warn('Error closing database:', e.message);
    }
    db = null;
  }
}

async function reopenDatabase(folderPath) {
  const targetFolder = folderPath || currentDbFolder;
  await closeDatabase();
  const newDb = await initDatabase(targetFolder);
  dbEvents.emit('change', '*');
  return newDb;
}

function getMigrationStatus() {
  return migrationDidRun;
}

module.exports = { 
  initDatabase, 
  getDb, 
  getDbFolder, 
  getDbPath, 
  closeDatabase, 
  reopenDatabase, 
  getMigrationStatus, 
  dbEvents 
};
