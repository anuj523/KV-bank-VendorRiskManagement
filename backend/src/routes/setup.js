const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const router = express.Router();

// One-time setup endpoint - creates admin user if not exists
router.post('/init', async (req, res) => {
  try {
    // Check if admin already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', ['admin@kvbank.com']);
    if (existing.rows.length > 0) {
      return res.json({ message: 'Admin already exists', status: 'ok' });
    }

    const hash = await bcrypt.hash('Admin@123', 10);
    await query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)`,
      ['admin@kvbank.com', hash, 'System Administrator', 'system_administrator']
    );

    res.json({ message: 'Admin user created successfully', email: 'admin@kvbank.com', password: 'Admin@123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health + DB check
router.get('/status', async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*) as count FROM users');
    res.json({ status: 'ok', users: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

module.exports = router;

// Reset admin password - call this if login fails
router.post('/reset-admin', async (req, res) => {
  try {
    const hash = await require('bcryptjs').hash('Admin@123', 10);
    await query(
      `UPDATE users SET password_hash = $1 WHERE email = $2`,
      [hash, 'admin@kvbank.com']
    );
    res.json({ message: 'Admin password reset to Admin@123', email: 'admin@kvbank.com' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
