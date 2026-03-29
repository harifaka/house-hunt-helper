const path = require('path');
const fs = require('fs');

// Use a temporary database for tests
const TEST_DB_PATH = path.join(__dirname, '..', 'db', 'test_db.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { getDb, initDb, DB_PATH } = require('../src/database');

afterAll(() => {
  try { fs.unlinkSync(TEST_DB_PATH); } catch (_e) { /* ignore */ }
});

describe('Database', () => {
  test('DB_PATH respects DATABASE_PATH env variable', () => {
    expect(DB_PATH).toBe(TEST_DB_PATH);
  });

  test('initDb creates tables without errors', () => {
    expect(() => initDb()).not.toThrow();
  });

  test('getDb returns a working database connection', () => {
    const db = getDb();
    try {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all().map(r => r.name);
      expect(tables).toContain('houses');
      expect(tables).toContain('answers');
      expect(tables).toContain('settings');
      expect(tables).toContain('scraped_properties');
      expect(tables).toContain('city_info');
      expect(tables).toContain('property_reports');
    } finally {
      db.close();
    }
  });

  test('default settings are inserted', () => {
    const db = getDb();
    try {
      const lang = db.prepare("SELECT value FROM settings WHERE key = 'language'").get();
      expect(lang.value).toBe('hu');
      const title = db.prepare("SELECT value FROM settings WHERE key = 'app_title'").get();
      expect(title.value).toBe('House Hunt');
    } finally {
      db.close();
    }
  });

  test('CRUD operations work on houses table', () => {
    const db = getDb();
    try {
      db.prepare('INSERT INTO houses (id, name, address, asking_price) VALUES (?, ?, ?, ?)')
        .run('test-1', 'DB Test House', '456 DB St', 30000000);

      const house = db.prepare('SELECT * FROM houses WHERE id = ?').get('test-1');
      expect(house.name).toBe('DB Test House');

      db.prepare('UPDATE houses SET name = ? WHERE id = ?').run('Updated House', 'test-1');
      const updated = db.prepare('SELECT * FROM houses WHERE id = ?').get('test-1');
      expect(updated.name).toBe('Updated House');

      db.prepare('DELETE FROM houses WHERE id = ?').run('test-1');
      const deleted = db.prepare('SELECT * FROM houses WHERE id = ?').get('test-1');
      expect(deleted).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
