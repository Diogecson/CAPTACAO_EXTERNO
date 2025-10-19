const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_TITLE = process.env.GOOGLE_SHEETS_SHEET_TITLE || 'Contacts';
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || path.join(__dirname, '..', 'credentials', 'service-account.json');
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/` : 'http://localhost:3000/');
const OAUTH_TOKEN_PATH = path.join(__dirname, '..', 'credentials', 'oauth-token.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

function normalizePhone(phone) { return (phone || '').replace(/\D+/g, ''); }

function createOAuth2Client() { return new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI); }

async function getSheetsClient() {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID não configurado');
  // Tenta usar JSON da Service Account via variável de ambiente
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (json) {
    const key = JSON.parse(json);
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: key.client_email, private_key: key.private_key },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }
  // Fallback: arquivo local (para desenvolvimento)
  if (fs.existsSync(KEY_FILE)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }
  // Fallback: OAuth via tokens (não recomendado no Vercel sem storage)
  if (OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET) {
    const oauth2 = createOAuth2Client();
    const tokenEnv = process.env.GOOGLE_OAUTH_TOKEN_JSON;
    if (tokenEnv) {
      const tokens = JSON.parse(tokenEnv);
      oauth2.setCredentials(tokens);
      return google.sheets({ version: 'v4', auth: oauth2 });
    }
    if (fs.existsSync(OAUTH_TOKEN_PATH)) {
      const raw = fs.readFileSync(OAUTH_TOKEN_PATH, 'utf-8');
      const tokens = JSON.parse(raw);
      oauth2.setCredentials(tokens);
      return google.sheets({ version: 'v4', auth: oauth2 });
    }
  }
  throw new Error('Nenhuma credencial disponível para Google Sheets. Configure GOOGLE_SERVICE_ACCOUNT_KEY_JSON.');
}

async function ensureSheetHeaders() {
  try {
    const sheets = await getSheetsClient();
    const range = `${SHEET_TITLE}!A1:G1`;
    const headers = ['NOME','TELEFONE','CURSO','CONSULTOR','DATA','USUARIO','SENHA'];
    const read = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const values = read.data.values || [];
    if (!values.length || values[0].length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      });
    }
  } catch (e) {
    console.warn('[Sheets] ensure headers warning:', e.message);
  }
}

async function readAllRows() {
  const sheets = await getSheetsClient();
  const range = `${SHEET_TITLE}!A:G`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  return resp.data.values || [];
}

async function findByPhone(phoneDigits) {
  const rows = await readAllRows();
  const hasHeader = rows.length && rows[0][0] === 'NOME';
  const startIndex = hasHeader ? 1 : 0;
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const rowPhone = normalizePhone(row[1]);
    if (rowPhone && rowPhone === phoneDigits) {
      return {
        rowIndex: i + 1,
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
  const values = [[ name || '', normalizePhone(phone), course || '', consultant || '', ts, usuario || '', '' ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// Registra credenciais de usuário na planilha (USUARIO e SENHA)
async function appendUserCredentials({ name, username, password }) {
  const sheets = await getSheetsClient();
  const now = new Date();
  const ts = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const range = `${SHEET_TITLE}!A:G`;
  const values = [[ name || '', '', '', '', ts, username || '', password || '' ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

function parseAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch (_) {
    return null;
  }
}

module.exports = {
  normalizePhone,
  ensureSheetHeaders,
  readAllRows,
  findByPhone,
  appendContact,
  appendUserCredentials,
  parseAuth,
};