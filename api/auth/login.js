const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const USERS_CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'users.json');

let USERS = [
  { username: 'admin', password: 'admin123', name: 'Admin', role: 'admin' },
  { username: 'ana', password: 'ana123', name: 'Ana Silva', role: 'editor' },
  { username: 'carlos', password: 'carlos123', name: 'Carlos Souza', role: 'viewer' },
];
try {
  if (fs.existsSync(USERS_CONFIG_PATH)) {
    const raw = fs.readFileSync(USERS_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) USERS = parsed;
  }
} catch (_) { /* ignore */ }

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: { message: 'Informe usuário e senha' } });
  }
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: { message: 'Credenciais inválidas' } });
  }
  const payload = { username: user.username, name: user.name, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  return res.status(200).json({ token, user: payload });
};