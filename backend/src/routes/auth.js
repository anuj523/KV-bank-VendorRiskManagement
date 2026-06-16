const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Internal user login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role, type: 'internal' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vendor portal login
router.post('/vendor-login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await query(
      `SELECT vu.*, v.name as vendor_name, v.status as vendor_status 
       FROM vendor_users vu JOIN vendors v ON vu.vendor_id = v.id 
       WHERE vu.email = $1 AND vu.is_active = true`,
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await query('UPDATE vendor_users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign({ id: user.id, vendor_id: user.vendor_id, type: 'vendor' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, type: 'vendor' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  const { password_hash, ...safeUser } = req.user;
  res.json(safeUser);
});

// Create internal user (admin only)
router.post('/register', auth, async (req, res) => {
  if (req.user.role !== 'system_administrator') return res.status(403).json({ error: 'Admin only' });
  const { email, password, full_name, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id,email,full_name,role,created_at',
      [email.toLowerCase(), hash, full_name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// List users (admin only)
router.get('/users', auth, async (req, res) => {
  if (!['system_administrator','risk_manager'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await query('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY full_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// Create vendor portal user (admin/VMO only)
router.post('/vendor-user', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { query } = require('../db');
    const { vendor_id, email, full_name, password } = req.body;
    if (!vendor_id || !email || !password) return res.status(400).json({ error: 'vendor_id, email and password required' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO vendor_users (vendor_id, email, password_hash, full_name) VALUES ($1,$2,$3,$4) RETURNING id, email, full_name, vendor_id, created_at`,
      [vendor_id, email.toLowerCase(), hash, full_name || email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});
