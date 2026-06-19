const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

// Use /tmp for uploads — works on Render free tier
// NOTE: For production, swap this for AWS S3 (files persist across deploys)
const uploadDir = '/tmp/vendor-uploads';
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
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

// Get documents for a vendor
router.get('/vendor/:vendorId', auth, async (req, res) => {
  // Vendor users can only see their own documents
  if (req.user.type === 'vendor' && req.user.vendor_id !== req.params.vendorId) {
    return res.status(403).json({ error: 'Access denied' });
  }
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
        `/api/documents/file/${req.file.filename}`,
        req.file.size, req.file.mimetype,
        valid_from || null, valid_until || null,
        is_mandatory === 'true', req.user.type === 'vendor'
      ]
    );
    await auditLog(req, 'document_uploaded', 'document', result.rows[0].id, null, { document_type, vendor_id });

    // After upload, check if this document type improves questionnaire compliance
    await updateDocumentCompliance(vendor_id, document_type);

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
    const docRes = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!docRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const doc = docRes.rows[0];

    const result = await query(
      `UPDATE documents SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4 RETURNING *`,
      [status, rejection_reason || null, req.user.id, req.params.id]
    );

    await auditLog(req, `document_${status}`, 'document', req.params.id, null, { status, rejection_reason });

    // If approved, update health status on vendor
    if (status === 'approved') {
      await updateVendorHealthFromDocs(doc.vendor_id);
    }

    // Create notification for vendor if rejected
    if (status === 'rejected') {
      await query(
        `INSERT INTO notifications (vendor_id, type, title, message)
         VALUES ($1, 'document_rejected', $2, $3)`,
        [doc.vendor_id, `Document Rejected: ${doc.document_type}`,
         `Your ${doc.document_type} was rejected. Reason: ${rejection_reason || 'No reason provided'}. Please resubmit.`]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Document expiry dashboard
router.get('/expiry/summary', auth, async (req, res) => {
  if (req.user.type === 'vendor') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  try {
    const [expiring30, expired, pending] = await Promise.all([
      query(`SELECT d.*, v.name as vendor_name FROM documents d JOIN vendors v ON d.vendor_id = v.id 
             WHERE d.valid_until BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND d.status = 'approved' ORDER BY d.valid_until`),
      query(`SELECT d.*, v.name as vendor_name FROM documents d JOIN vendors v ON d.vendor_id = v.id 
             WHERE d.valid_until < NOW() AND d.status = 'approved' ORDER BY d.valid_until`),
      query(`SELECT COUNT(*) as count FROM documents WHERE status = 'pending'`)
    ]);
    res.json({
      expiring_soon: expiring30.rows,
      expired: expired.rows,
      pending_review: parseInt(pending.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve uploaded files
router.get('/file/:filename', auth, (req, res) => {
  // Sanitize filename — no path traversal
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found. Note: files are reset on server redeploy. Please re-upload.' });
  }
  res.sendFile(filePath);
});

// Get notifications for a vendor
router.get('/notifications/:vendorId', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notifications WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.vendorId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: map document types to questionnaire question keys
async function updateDocumentCompliance(vendorId, documentType) {
  const docToQuestion = {
    'SOC 2 Type II Report': 'soc2_available',
    'Penetration Test Report': 'pentest_annual',
    'VAPT Report': 'pentest_annual',
    'Business Continuity Plan': 'bcp_existence',
    'Disaster Recovery Plan': 'bcp_existence',
    'Insurance Certificate': 'insurance_coverage',
    'NDA / Confidentiality Agreement': 'confidentiality_controls',
    'Data Processing Agreement': 'dpdpa_compliance',
    'ISO 27001 Certificate': 'encryption_at_rest',
  };
  const questionKey = docToQuestion[documentType];
  if (!questionKey) return;

  // Mark the corresponding questionnaire answer as partially compliant if it was non-compliant
  await query(
    `UPDATE questionnaire_responses 
     SET answer = CASE WHEN answer = 'non_compliant' THEN 'partially_compliant' ELSE answer END,
         notes = COALESCE(notes, '') || ' [Document uploaded: ' || $1 || ']'
     WHERE vendor_id = $2 AND question_key = $3 AND answer = 'non_compliant'`,
    [documentType, vendorId, questionKey]
  );
}

// Helper: update vendor health based on document status
async function updateVendorHealthFromDocs(vendorId) {
  const result = await query(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE valid_until < NOW() AND status = 'approved') as expired
     FROM documents WHERE vendor_id = $1`,
    [vendorId]
  );
  const { approved, pending, rejected, expired } = result.rows[0];

  let health = 'green';
  if (parseInt(expired) > 0 || parseInt(rejected) > 0) health = 'amber';
  if (parseInt(expired) > 2 || parseInt(rejected) > 1) health = 'red';

  await query(
    'UPDATE vendors SET health_status = $1, updated_at = NOW() WHERE id = $2',
    [health, vendorId]
  );
}

module.exports = router;
