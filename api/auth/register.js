const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { appendUserCredentials } = require('../_shared');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const ALLOW_PUBLIC_REGISTRATION = process.env.ALLOW_PUBLIC_REGISTRATION !== 'false';
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

function persistUsers(users) {
  try {
    fs.writeFileSync(USERS_CONFIG_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (_) {
    // Em Vercel não persiste; ignorar falha
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  if (!ALLOW_PUBLIC_REGISTRATION) {
    return res.status(403).json({ error: { message: 'Registro público desativado' } });
  }
  const { username, password, name } = req.body || {};
  const uname = (username || '').trim();
  const pass = (password || '').trim();
  const displayName = (name || '').trim();
  if (!uname || !pass || !displayName) {
    return res.status(400).json({ error: { message: 'Informe nome, usuário e senha' } });
  }
  if (!/^[a-zA-Z0-9._-]{3,}$/.test(uname)) {
    return res.status(400).json({ error: { message: 'Usuário deve ter ao menos 3 caracteres e ser alfanumérico (. _ -)' } });
  }
  const exists = USERS.find(u => u.username.toLowerCase() === uname.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: { message: 'Usuário já existe' } });
  }
  const newUser = { username: uname, password: pass, name: displayName, role: 'viewer', createdAt: new Date().toISOString() };
  USERS.push(newUser);
  persistUsers(USERS);

  const payload = { username: newUser.username, name: newUser.name, role: newUser.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

  // Tenta registrar credenciais na planilha (não bloqueia registro em caso de falha)
  try { await appendUserCredentials({ name: displayName, username: uname, password: pass }); } catch (_) {}

  return res.status(201).json({ token, user: payload });
};