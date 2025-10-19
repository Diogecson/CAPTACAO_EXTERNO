const { parseAuth } = require('../_shared');
const { google } = require('googleapis');

const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/` : 'http://localhost:3000/');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const user = parseAuth(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Permissão negada' } });
  }
  if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
    return res.status(400).json({ error: { message: 'Credenciais OAuth não configuradas no .env' } });
  }
  const oauth2 = new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI);
  const url = oauth2.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/spreadsheets'], prompt: 'consent' });
  return res.status(200).json({ url });
};