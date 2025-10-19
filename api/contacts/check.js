const { normalizePhone, findByPhone } = require('../_shared');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const phone = normalizePhone(req.query.phone || '');
  if (!phone) {
    return res.status(400).json({ error: { message: 'Telefone inválido' } });
  }
  try {
    const existing = await findByPhone(phone);
    if (!existing) return res.status(200).json({ duplicate: false });
    return res.status(200).json({ duplicate: true, existing });
  } catch (err) {
    return res.status(500).json({ error: { message: 'Falha ao consultar planilha', details: err.message } });
  }
};