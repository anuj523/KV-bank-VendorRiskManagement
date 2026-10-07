const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('query', { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
};

const initDb = async () => {
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ Database schema initialised');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
  await seedAdmin();
};

// Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if no such user exists.
// Existing passwords are only overwritten when ADMIN_RESET_PASSWORD=true — set it,
// deploy, log in, then remove it again.
const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️  ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }
  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const reset = process.env.ADMIN_RESET_PASSWORD === 'true';
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, 'System Administrator', 'system_administrator')
       ON CONFLICT (email) DO ${reset
         ? 'UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true'
         : 'NOTHING'}
       RETURNING (xmax = 0) AS inserted`,
      [email.toLowerCase(), hash]
    );
    if (res.rows[0]?.inserted) console.log(`✅ Admin user created: ${email}`);
    else if (reset) console.log(`🔑 Admin password reset from ADMIN_PASSWORD: ${email} — remove ADMIN_RESET_PASSWORD now`);
    else console.log(`ℹ️  Admin ${email} already exists — password unchanged`);
  } catch (err) {
    console.error('❌ Admin seed error:', err.message);
  }
};

module.exports = { query, pool, initDb };
