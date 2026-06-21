import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');

// Connect without a specific database to see what's available
const conn = await mysql.createConnection({
  uri: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

try {
  const [databases] = await conn.execute("SHOW DATABASES");
  console.log('Databases:', databases);

  // Attempt to use 'test' or create our own
  let targetDb = 'test';
  const hasTest = databases.some(row => row.Database === 'test');

  if (!hasTest) {
    targetDb = 'credential_hunter';
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${targetDb}`);
  }

  await conn.query(`USE ${targetDb}`);
  console.log(`✓ Using database: ${targetDb}`);

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openId VARCHAR(64) NOT NULL UNIQUE,
      name TEXT,
      email VARCHAR(320),
      loginMethod VARCHAR(64),
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(64) NOT NULL,
      key_value TEXT NOT NULL,
      key_masked VARCHAR(64) NOT NULL,
      validity ENUM('valid','invalid','unknown','rate_limited') NOT NULL DEFAULT 'unknown',
      last_checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP NULL,
      usage_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      provider VARCHAR(64),
      key_id INT,
      details TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS provider_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(64) NOT NULL UNIQUE,
      valid_key_count INT NOT NULL DEFAULT 0,
      total_key_count INT NOT NULL DEFAULT 0,
      last_refresh_at TIMESTAMP NULL,
      active_key_id INT,
      total_requests INT NOT NULL DEFAULT 0,
      failed_requests INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of tables) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    try {
      await conn.execute(sql);
      console.log(`✓ Created table: ${tableName}`);
    } catch (e) {
      console.error(`✗ Failed to create ${tableName}:`, e.message);
    }
  }

  const [rows] = await conn.execute("SHOW TABLES");
  console.log('\nTables in database:', rows);

} catch (e) {
  console.error("Error:", e.message);
} finally {
  await conn.end();
}
