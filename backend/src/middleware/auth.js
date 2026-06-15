const jwt = require('jsonwebtoken');
const { query } = require('../db');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check if it's a vendor user or internal user
    if (decoded.type === 'vendor') {
      const result = await query(
        'SELECT * FROM vendor_users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      if (!result.rows.length) return res.status(401).json({ error: 'Invalid token' });
      req.user = { ...result.rows[0], type: 'vendor' };
    } else {
      const result = await query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      if (!result.rows.length) return res.status(401).json({ error: 'Invalid token' });
      req.user = { ...result.rows[0], type: 'internal' };
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const auditLog = async (req, action, entityType, entityId, oldVal, newVal) => {
  try {
    await query(
      `INSERT INTO audit_trail (vendor_id, user_id, vendor_user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        req.body?.vendor_id || entityId,
        req.user?.type === 'internal' ? req.user.id : null,
        req.user?.type === 'vendor' ? req.user.id : null,
        action, entityType, entityId,
        oldVal ? JSON.stringify(oldVal) : null,
        newVal ? JSON.stringify(newVal) : null,
        req.ip
      ]
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
};

module.exports = { auth, requireRole, auditLog };
