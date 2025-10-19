const fs = require('fs');
const path = require('path');
const { parseAuth } = require('../_shared');

const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || path.join(__dirname, '..', '..', 'credentials', 'service-account.json');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const user = parseAuth(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Permissão negada' } });
  }
  const serviceAccountJsonInEnv = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  const oauthConfigured = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  const oauthTokensInEnv = !!process.env.GOOGLE_OAUTH_TOKEN_JSON;
  const serviceAccountFileExists = fs.existsSync(KEY_FILE);
  return res.status(200).json({
    serviceAccountEnv: serviceAccountJsonInEnv,
    serviceAccountFile: serviceAccountFileExists,
    oauthConfigured,
    oauthTokensInEnv,
  });
};