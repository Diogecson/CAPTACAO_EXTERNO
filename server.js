const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { google } = require('googleapis');

dotenv.config();

// ===== Configurações =====
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_TITLE = process.env.GOOGLE_SHEETS_SHEET_TITLE || 'Contacts';
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || path.join(__dirname, 'credentials', 'service-account.json');
// OAuth env
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/';
const OAUTH_TOKEN_PATH = path.join(__dirname, 'credentials', 'oauth-token.json');
const ALLOW_PUBLIC_CONTACTS = process.env.ALLOW_PUBLIC_CONTACTS === 'true';

// ===== Usuários e perfis (exemplo; em produção, usar base de dados/segurança adequada) =====
const USERS_CONFIG_PATH = path.join(__dirname, 'config', 'users.json');
const ALLOW_PUBLIC_REGISTRATION = process.env.ALLOW_PUBLIC_REGISTRATION !== 'false';
let USERS = [
  { username: 'admin', password: 'admin123', name: 'Admin', role: 'admin' },
  { username: 'ana', password: 'ana123', name: 'Ana Silva', role: 'editor' },
  { username: 'carlos', password: 'carlos123', name: 'Carlos Souza', role: 'viewer' },
];
try {
  if (fs.existsSync(USERS_CONFIG_PATH)) {
    const raw = fs.readFileSync(USERS_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      USERS = parsed;
    }
  }
} catch (e) {
  console.warn('[WARN] Não foi possível ler config/users.json. Usando usuários padrão.');
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_CONFIG_PATH, JSON.stringify(USERS, null, 2), 'utf-8');
  } catch (e) {
    console.error('[ERROR] Falha ao salvar usuários:', e.message);
  }
}

// ===== Helpers =====
function normalizePhone(phone) {
  return (phone || '').replace(/\D+/g, '');
}

function responseError(res, status, message, details = undefined) {
  return res.status(status).json({ error: { message, details } });
}

function createOAuth2Client() {
  return new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI);
}

// ===== Google Sheets Client =====
async function getSheetsClient() {
  if (!SHEET_ID) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID não configurado. Defina no .env');
  }
  // Preferir Service Account se existir
  if (fs.existsSync(KEY_FILE)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }
  // Fallback para OAuth se configurado
  if (OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET) {
    const oauth2 = createOAuth2Client();
    if (fs.existsSync(OAUTH_TOKEN_PATH)) {
      try {
        const raw = fs.readFileSync(OAUTH_TOKEN_PATH, 'utf-8');
        const tokens = JSON.parse(raw);
        oauth2.setCredentials(tokens);
        return google.sheets({ version: 'v4', auth: oauth2 });
      } catch (e) {
        throw new Error('Tokens OAuth inválidos. Refaça a autorização.');
      }
    } else {
      throw new Error('Nenhuma credencial disponível: autorize Google via OAuth (admin) para gerar tokens.');
    }
  }
  throw new Error(`Nenhuma credencial disponível: configure Service Account em ${KEY_FILE} ou defina GOOGLE_OAUTH_CLIENT_ID/SECRET e autorize.`);
}

async function ensureSheetHeaders() {
  try {
    const sheets = await getSheetsClient();
    const range = `${SHEET_TITLE}!A1:G1`;
    const headers = ['NOME', 'TELEFONE', 'CURSO', 'CONSULTOR', 'DATA', 'USUARIO', 'SENHA'];
    const read = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const values = read.data.values || [];
    if (!values.length || values[0].length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      });
      console.log('[Sheets] Cabeçalhos criados em', range);
    }
  } catch (err) {
    console.warn('[Sheets] Aviso ao checar/criar cabeçalhos:', err.message);
  }
}

async function readAllRows() {
  const sheets = await getSheetsClient();
  const range = `${SHEET_TITLE}!A:G`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const rows = resp.data.values || [];
  return rows;
}

async function findByPhone(phoneDigits) {
  const rows = await readAllRows();
  // Ignorar a linha de cabeçalho se existir
  let startIndex = 0;
  if (rows.length && rows[0][0] === 'NOME') {
    startIndex = 1;
  }
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const rowPhone = normalizePhone(row[1]);
    if (rowPhone && rowPhone === phoneDigits) {
      return {
        rowIndex: i + 1, // índice real da planilha (1-based)
        name: row[0] || '',
        phone: row[1] || '',
        course: row[2] || '',
        consultant: row[3] || '',
        date: row[4] || '',
        usuario: row[5] || '',
        senha: row[6] || '',
      };
    }
  }
  return null;
}

async function appendContact({ name, phone, course, consultant, usuario }) {
  const sheets = await getSheetsClient();
  const now = new Date();
  const ts = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const range = `${SHEET_TITLE}!A:G`;
  const values = [[
    name || '',
    normalizePhone(phone),
    course || '',
    consultant || '',
    ts,
    usuario || '',
    '' // senha (não armazenamos senha por segurança)
  ]];
  const resp = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return resp.data;
}

// Registra credenciais de usuário na planilha (USUARIO e SENHA)
async function appendUserCredentials({ name, username, password }) {
  const sheets = await getSheetsClient();
  const now = new Date();
  const ts = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const range = `${SHEET_TITLE}!A:G`;
  const values = [[
    name || '',
    '', // telefone
    '', // curso
    '', // consultor
    ts,
    username || '',
    password || ''
  ]];
  const resp = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return resp.data;
}

// ===== Middlewares =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return responseError(res, 401, 'Token ausente');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return responseError(res, 401, 'Token inválido');
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return responseError(res, 403, 'Permissão negada');
    }
    next();
  };
}

// Middleware opcional: permite acesso público às rotas de contatos quando ALLOW_PUBLIC_CONTACTS=true
function optionalAuth(allowedRoles) {
  return (req, res, next) => {
    if (ALLOW_PUBLIC_CONTACTS) {
      // Se houver token, tenta validar; caso inválido, segue como público
      const authHeader = req.headers['authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        try {
          const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
          req.user = payload;
        } catch (_) {
          req.user = null;
        }
      }
      // Se usuário autenticado tem papel permitido, segue
      if (req.user?.role && allowedRoles.includes(req.user.role)) {
        return next();
      }
      // Caso contrário, segue como público
      req.user = req.user || { username: 'public', name: 'public', role: 'public' };
      return next();
    }
    // Modo padrão: exige autenticação e papel permitido
    authenticateToken(req, res, () => {
      const role = req.user?.role;
      if (!role || !allowedRoles.includes(role)) {
        return responseError(res, 403, 'Permissão negada');
      }
      next();
    });
  };
}

// ===== App =====
const app = express();
app.use(cors());
app.use(express.json());

// Servir frontend
app.use(express.static(path.join(__dirname, 'public')));

// ===== Rotas de Autenticação =====
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return responseError(res, 400, 'Informe usuário e senha');
  }
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return responseError(res, 401, 'Credenciais inválidas');
  }
  const payload = { username: user.username, name: user.name, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  return res.json({ token, user: payload });
});

// Registro público de usuário (role: viewer)
app.post('/api/auth/register', (req, res) => {
  if (!ALLOW_PUBLIC_REGISTRATION) {
    return responseError(res, 403, 'Registro público desativado');
  }
  const { username, password, name } = req.body || {};
  const uname = (username || '').trim();
  const pass = (password || '').trim();
  const displayName = (name || '').trim();
  if (!uname || !pass || !displayName) {
    return responseError(res, 400, 'Informe nome, usuário e senha');
  }
  if (!/^[a-zA-Z0-9._-]{3,}$/.test(uname)) {
    return responseError(res, 400, 'Usuário deve ter ao menos 3 caracteres e ser alfanumérico (. _ -)');
  }
  const exists = USERS.find(u => u.username.toLowerCase() === uname.toLowerCase());
  if (exists) {
    return responseError(res, 409, 'Usuário já existe');
  }
  const newUser = { username: uname, password: pass, name: displayName, role: 'viewer', createdAt: new Date().toISOString() };
  USERS.push(newUser);
  saveUsers();
  const payload = { username: newUser.username, name: newUser.name, role: newUser.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

  // Tenta escrever credenciais na planilha (sem impedir o registro caso falhe)
  (async () => {
    try {
      await appendUserCredentials({ name: displayName, username: uname, password: pass });
      console.log('[Sheets] Usuário e senha registrados na planilha.');
    } catch (err) {
      console.warn('[Sheets] Falha ao registrar usuário na planilha:', err.message);
    }
  })();

  return res.status(201).json({ token, user: payload });
});

// ===== Rotas de Contatos =====
// Checar duplicidade (liberado para viewer/editor/admin ou público se flag ativa)
app.get('/api/contacts/check', optionalAuth(['viewer', 'editor', 'admin']), async (req, res) => {
  const phone = normalizePhone(req.query.phone || '');
  if (!phone) return responseError(res, 400, 'Telefone inválido');
  try {
    const existing = await findByPhone(phone);
    if (!existing) return res.json({ duplicate: false });
    return res.json({ duplicate: true, existing });
  } catch (err) {
    return responseError(res, 500, 'Falha ao consultar planilha', err.message);
  }
});

// Adicionar contato (liberado para viewer/editor/admin ou público se flag ativa)
app.post('/api/contacts/add', optionalAuth(['viewer', 'editor', 'admin']), async (req, res) => {
  const { name, phone, course, consultant: consultantBody } = req.body || {};
  // Para acessos públicos, usar consultor informado no corpo; para logados, usar o nome do usuário
  const consultant = (req.user?.role === 'public') ? (consultantBody || 'public') : (req.user?.name || 'public');
  const usuario = req.user?.username || 'public';
  if (!name || !phone) return responseError(res, 400, 'Nome e telefone são obrigatórios');
  try {
    const phoneDigits = normalizePhone(phone);
    const existing = await findByPhone(phoneDigits);
    if (existing) {
      return res.status(409).json({
        error: {
          message: 'Telefone já cadastrado',
          existing,
        },
      });
    }
    await appendContact({ name, phone: phoneDigits, course, consultant, usuario });
    return res.json({ ok: true });
  } catch (err) {
    return responseError(res, 500, 'Falha ao adicionar contato na planilha', err.message);
  }
});

// Listar contatos (somente admin)
app.get('/api/contacts/list', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const rows = await readAllRows();
    const hasHeader = rows.length && rows[0][0] === 'NOME';
    const startIndex = hasHeader ? 1 : 0;
    const list = [];
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      list.push({
        rowIndex: i + 1,
        name: row[0] || '',
        phone: row[1] || '',
        course: row[2] || '',
        consultant: row[3] || '',
        date: row[4] || '',
        usuario: row[5] || '',
        senha: row[6] || '',
      });
    }
    return res.json({ items: list });
  } catch (err) {
    return responseError(res, 500, 'Falha ao listar contatos', err.message);
  }
});

// Inicialização
app.listen(PORT, async () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  await ensureSheetHeaders();
});

// ===== OAuth Google =====
app.get('/api/google/auth-url', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
    return responseError(res, 400, 'Credenciais OAuth não configuradas no .env');
  }
  const oauth2 = createOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent',
  });
  res.json({ url });
});

app.post('/api/google/oauth/callback', async (req, res) => {
  const code = req.body?.code;
  if (!code) return responseError(res, 400, 'Código OAuth ausente');
  try {
    const oauth2 = createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    fs.mkdirSync(path.join(__dirname, 'credentials'), { recursive: true });
    fs.writeFileSync(OAUTH_TOKEN_PATH, JSON.stringify(tokens, null, 2));
    return res.json({ ok: true });
  } catch (err) {
    return responseError(res, 500, 'Falha ao trocar código por token', err.message);
  }
});

app.get('/api/google/status', authenticateToken, requireRole(['admin']), (req, res) => {
  res.json({
    serviceAccount: fs.existsSync(KEY_FILE),
    oauthConfigured: !!(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET),
    oauthToken: fs.existsSync(OAUTH_TOKEN_PATH),
  });
});