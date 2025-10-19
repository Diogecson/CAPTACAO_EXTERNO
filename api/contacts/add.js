const { appendContact, normalizePhone, findByPhone, parseAuth } = require('../_shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const { name, phone, course, consultant: consultantBody } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: { message: 'Nome e telefone são obrigatórios' } });
  }
  try {
    const phoneDigits = normalizePhone(phone);
    const existing = await findByPhone(phoneDigits);
    if (existing) {
      return res.status(409).json({ error: { message: 'Telefone já cadastrado', existing } });
    }
    const auth = parseAuth(req);
    const consultant = (!auth || auth.role === 'public') ? (consultantBody || 'public') : (auth.name || 'public');
    const usuario = auth?.username || 'public';
    await appendContact({ name, phone: phoneDigits, course, consultant, usuario });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: { message: 'Falha ao adicionar contato na planilha', details: err.message } });
  }
};