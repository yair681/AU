const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static files ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// ── Data directory ──────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '../data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'form-config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    password: 'hila2025',
    gardenName: 'הגן הקסום',
    agreementText: 'אני מסכים/ה לתנאי הגן',
    hours: '07:30 - 14:00',
    vacations: []
  }, null, 2));
}

// ── Helpers ─────────────────────────────────────────────────
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ── Routes ───────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get form config (public)
app.get('/api/config', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  const { password, ...publicConfig } = config;
  res.json(publicConfig);
});

// Submit form
app.post('/api/submit', (req, res) => {
  const submissions = readJSON(SUBMISSIONS_FILE);
  const submission = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...req.body
  };
  submissions.push(submission);
  writeJSON(SUBMISSIONS_FILE, submissions);
  res.json({ success: true, id: submission.id });
});

// ── Admin routes ─────────────────────────────────────────────

// Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const config = readJSON(CONFIG_FILE);
  if (password === config.password) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'סיסמה שגויה' });
  }
});

// Get all submissions (protected by password in body)
app.post('/api/admin/submissions', (req, res) => {
  const { password } = req.body;
  const config = readJSON(CONFIG_FILE);
  if (password !== config.password) return res.status(401).json({ error: 'Unauthorized' });
  const submissions = readJSON(SUBMISSIONS_FILE);
  res.json(submissions);
});

// Delete submission
app.delete('/api/admin/submissions/:id', (req, res) => {
  const { password } = req.body;
  const config = readJSON(CONFIG_FILE);
  if (password !== config.password) return res.status(401).json({ error: 'Unauthorized' });
  let submissions = readJSON(SUBMISSIONS_FILE);
  submissions = submissions.filter(s => s.id !== req.params.id);
  writeJSON(SUBMISSIONS_FILE, submissions);
  res.json({ success: true });
});

// Update config (admin)
app.post('/api/admin/config', (req, res) => {
  const { password, newPassword, ...updates } = req.body;
  const config = readJSON(CONFIG_FILE);
  if (password !== config.password) return res.status(401).json({ error: 'Unauthorized' });
  const updatedConfig = { ...config, ...updates };
  if (newPassword) updatedConfig.password = newPassword;
  writeJSON(CONFIG_FILE, updatedConfig);
  res.json({ success: true });
});

// ── Catch-all → parent form ──────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌟 גן הקסום — Server running on http://localhost:${PORT}`);
  console.log(`📋 Parent form: http://localhost:${PORT}/`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin/`);
  console.log(`🔑 Default password: hila2025`);
});
