const { google } = require('googleapis');

const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/` : 'http://localhost:3000/');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const code = req.body?.code;
  if (!code) {
    return res.status(400).json({ error: { message: 'Código OAuth ausente' } });
  }
  try {
    const oauth2 = new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI);
    const { tokens } = await oauth2.getToken(code);
    // Em Vercel, persistir tokens em arquivo não funciona; instrução para usar variável de ambiente
    // Se desejar, copie o JSON retornado para a variável GOOGLE_OAUTH_TOKEN_JSON nas configurações do projeto.
    return res.status(200).json({ ok: true, tokens });
  } catch (err) {
    return res.status(500).json({ error: { message: 'Falha ao trocar código por token', details: err.message } });
  }
};