const { readAllRows, parseAuth } = require('../_shared');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }
  const user = parseAuth(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Permissão negada' } });
  }
  try {
    const rows = await readAllRows();
    const hasHeader = rows.length && rows[0][0] === 'NOME';
    const startIndex = hasHeader ? 1 : 0;
    const items = [];
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      items.push({
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
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: { message: 'Falha ao listar contatos', details: err.message } });
  }
};