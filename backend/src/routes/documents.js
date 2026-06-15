const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

// Local file storage (swap for S3 in production)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

// Get documents for a vendor
router.get('/vendor/:vendorId', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM documents WHERE vendor_id = $1 ORDER BY created_at DESC',
      [req.params.vendorId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload document
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { vendor_id, document_type, valid_from, valid_until, is_mandatory } = req.body;

  try {
    const result = await query(
      `INSERT INTO documents (vendor_id, document_type, file_name, file_path, file_size, mime_type, valid_from, valid_until, is_mandatory, uploaded_by_vendor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        vendor_id, document_type, req.file.originalname,
        `/uploads/${req.file.filename}`, req.file.size, req.file.mimetype,
        valid_from || null, valid_until || null,
        is_mandatory === 'true', req.user.type === 'vendor'
      ]
    );
    await auditLog(req, 'document_uploaded', 'document', result.rows[0].id, null, { document_type, vendor_id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Review document (approve/reject)
router.patch('/:id/review', auth, async (req, res) => {
  const { status, rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const result = await query(
      `UPDATE documents SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4 RETURNING *`,
      [status, rejection_reason || null, req.user.id, req.params.id]
    );
    await auditLog(req, `document_${status}`, 'document', req.params.id, null, { status, rejection_reason });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Document expiry dashboard
router.get('/expiry/summary', auth, async (req, res) => {
  try {
    const [expiring30, expired, missing] = await Promise.all([
      query(`SELECT d.*, v.name as vendor_name FROM documents d JOIN vendors v ON d.vendor_id = v.id 
             WHERE d.valid_until BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND d.status = 'approved' ORDER BY d.valid_until`),
      query(`SELECT d.*, v.name as vendor_name FROM documents d JOIN vendors v ON d.vendor_id = v.id 
             WHERE d.valid_until < NOW() AND d.status = 'approved' ORDER BY d.valid_until`),
      query(`SELECT COUNT(*) as count FROM documents WHERE status = 'pending'`)
    ]);
    res.json({
      expiring_soon: expiring30.rows,
      expired: expired.rows,
      pending_review: parseInt(missing.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve uploaded files
router.get('/file/:filename', auth, (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
