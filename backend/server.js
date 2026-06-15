require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./src/db');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/setup', require('./src/routes/setup'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/vendors', require('./src/routes/vendors'));
app.use('/api/risk', require('./src/routes/risk'));
app.use('/api/findings', require('./src/routes/findings'));
app.use('/api/documents', require('./src/routes/documents'));
app.use('/api/ai', require('./src/routes/ai'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 Vendor Risk360 API running on port ${PORT}`);
  });
};

start().catch(console.error);
