// ===== Estado =====
let AUTH = {
  token: null,
  user: null,
};

// ===== Helpers =====
function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setMsg(el, kind, text) {
  el.classList.remove('error', 'success');
  if (!text) { el.textContent = ''; el.classList.remove('error', 'success'); return; }
  if (kind === 'error') el.classList.add('error');
  if (kind === 'success') el.classList.add('success');
  el.textContent = text;
}
function normalizePhone(phone) { return (phone || '').replace(/\D+/g, ''); }

function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (AUTH.token) headers['Authorization'] = 'Bearer ' + AUTH.token;
  return fetch(path, Object.assign({}, options, { headers }));
}

function updateUIAuth() {
  const authSection = $('authSection');
  const formSection = $('formSection');
  const adminSection = $('adminSection');
  const userInfo = $('userInfo');
  const logoutBtn = $('logoutBtn');

  if (AUTH.token && AUTH.user) {
    hide(authSection);
    show(formSection); // Sempre mostrar formulário, mesmo logado
    show(logoutBtn);
    userInfo.textContent = `Logado como: ${AUTH.user.name} (${AUTH.user.role})`;
    show(userInfo);
    if (AUTH.user.role === 'admin') {
      show(adminSection);
    } else {
      hide(adminSection);
    }
  } else {
    // Sem login: mostrar formulário e manter admin oculto
    show(formSection);
    show(authSection); // Login continua disponível para quem quiser usar painel/admin
    hide(adminSection);
    hide(userInfo);
    hide(logoutBtn);
  }
}

function storeAuth(token, user) {
  AUTH.token = token;
  AUTH.user = user;
  localStorage.setItem('auth', JSON.stringify({ token, user }));
}
function loadAuth() {
  try {
    const raw = localStorage.getItem('auth');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user) {
      AUTH.token = parsed.token;
      AUTH.user = parsed.user;
    }
  } catch (_) {}
}
function clearAuth() {
  AUTH = { token: null, user: null };
  localStorage.removeItem('auth');
}

// ===== Login =====
$('loginBtn').addEventListener('click', async () => {
  const username = $('username').value.trim();
  const password = $('password').value.trim();
  setMsg($('loginMsg'), '', '');
  if (!username || !password) {
    setMsg($('loginMsg'), 'error', 'Informe usuário e senha.');
    return;
  }
  try {
    const resp = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setMsg($('loginMsg'), 'error', data?.error?.message || 'Falha no login');
      return;
    }
    storeAuth(data.token, data.user);
    updateUIAuth();
    setMsg($('loginMsg'), 'success', 'Login realizado com sucesso.');
  } catch (err) {
    setMsg($('loginMsg'), 'error', 'Erro de comunicação com o servidor.');
  }
});

// Toggle mostrar/ocultar senha
function togglePassword(inputId, btnId) {
  const input = $(inputId);
  const btn = $(btnId);
  if (!input || !btn) return;
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  btn.textContent = hidden ? '🙈' : '👁️';
  btn.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
}
$('toggleLoginPassword')?.addEventListener('click', () => togglePassword('password', 'toggleLoginPassword'));
$('toggleRegisterPassword')?.addEventListener('click', () => togglePassword('regPassword', 'toggleRegisterPassword'));

// ===== Logout =====
$('logoutBtn').addEventListener('click', () => {
  clearAuth();
  updateUIAuth();
});

// ===== Registro público =====
$('openRegisterBtn').addEventListener('click', () => {
  show($('registerCard'));
});
$('backToLoginBtn').addEventListener('click', () => {
  hide($('registerCard'));
});
$('createAccountBtn').addEventListener('click', async () => {
  const name = $('regName').value.trim();
  const username = $('regUsername').value.trim();
  const password = $('regPassword').value.trim();
  const regMsg = $('registerMsg');
  setMsg(regMsg, '', '');
  if (!name || !username || !password) {
    setMsg(regMsg, 'error', 'Informe nome, usuário e senha.');
    return;
  }
  try {
    const resp = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, password })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setMsg(regMsg, 'error', data?.error?.message || 'Falha ao criar conta.');
      return;
    }
    storeAuth(data.token, data.user);
    updateUIAuth();
    hide($('registerCard'));
    setMsg($('loginMsg'), 'success', 'Conta criada! Você já está logado.');
  } catch (err) {
    setMsg(regMsg, 'error', 'Erro ao criar conta.');
  }
});

// ===== Verificação de duplicidade =====
$('checkBtn').addEventListener('click', async () => {
  const phone = normalizePhone($('phone').value);
  const formMsg = $('formMsg');
  const dpPanel = $('duplicatePanel');
  const dpDetails = $('duplicateDetails');
  setMsg(formMsg, '', ''); dpDetails.innerHTML = ''; hide(dpPanel);
  if (!phone) {
    setMsg(formMsg, 'error', 'Informe um telefone válido.');
    return;
  }
  try {
    const resp = await apiFetch(`/api/contacts/check?phone=${encodeURIComponent(phone)}`);
    const data = await resp.json();
    if (!resp.ok) {
      setMsg(formMsg, 'error', data?.error?.message || 'Falha ao verificar.');
      return;
    }
    if (data.duplicate) {
      const ex = data.existing;
      dpDetails.innerHTML = `
        <li><strong>Nome:</strong> ${ex.name || '-'} </li>
        <li><strong>Telefone:</strong> ${ex.phone || '-'} </li>
        <li><strong>Curso:</strong> ${ex.course || '-'} </li>
        <li><strong>Consultor:</strong> ${ex.consultant || '-'} </li>
        <li><strong>Data:</strong> ${ex.date || '-'} </li>
        <li><strong>Usuário:</strong> ${ex.usuario || '-'} </li>
      `;
      show(dpPanel);
      setMsg(formMsg, 'error', 'Telefone já cadastrado.');
    } else {
      setMsg(formMsg, 'success', 'Telefone disponível para cadastro.');
    }
  } catch (err) {
    setMsg(formMsg, 'error', 'Erro ao consultar duplicidade.');
  }
});

// ===== Cadastro de contato =====
(function setupCourseConsultantToggles() {
  const courseSelect = $('courseSelect');
  const courseOther = $('course');
  if (courseSelect && courseOther) {
    courseSelect.addEventListener('change', () => {
      if (courseSelect.value === 'OUTROS') {
        show(courseOther);
      } else {
        hide(courseOther);
        courseOther.value = '';
      }
    });
  }
  const consultantSelect = $('consultantSelect');
  const consultantOther = $('consultant');
  if (consultantSelect && consultantOther) {
    consultantSelect.addEventListener('change', () => {
      if (consultantSelect.value === 'Outro') {
        show(consultantOther);
      } else {
        hide(consultantOther);
        consultantOther.value = '';
      }
    });
  }
})();
$('submitBtn').addEventListener('click', async () => {
  const name = $('name').value.trim();
  const phone = normalizePhone($('phone').value);
  const courseSelect = $('courseSelect');
  const selectedCourse = courseSelect?.value || '';
  const courseOther = $('course').value.trim();
  const course = selectedCourse === 'OUTROS' ? courseOther : (selectedCourse || courseOther);
  const consultantSelect = $('consultantSelect');
  const selectedConsultant = consultantSelect?.value || '';
  const consultantOther = $('consultant')?.value?.trim() || '';
  const consultant = selectedConsultant === 'Outro' ? consultantOther : (selectedConsultant || consultantOther);
  const formMsg = $('formMsg');
  const dpPanel = $('duplicatePanel');
  const dpDetails = $('duplicateDetails');
  setMsg(formMsg, '', ''); dpDetails.innerHTML = ''; hide(dpPanel);

  if (!name || !phone) {
    setMsg(formMsg, 'error', 'Nome e telefone são obrigatórios.');
    return;
  }
  try {
    const resp = await apiFetch('/api/contacts/add', {
      method: 'POST',
      body: JSON.stringify({ name, phone, course, consultant })
    });
    const data = await resp.json();
    if (!resp.ok) {
      if (resp.status === 409 && data?.error?.existing) {
        const ex = data.error.existing;
        dpDetails.innerHTML = `
          <li><strong>Nome:</strong> ${ex.name || '-'} </li>
          <li><strong>Telefone:</strong> ${ex.phone || '-'} </li>
          <li><strong>Curso:</strong> ${ex.course || '-'} </li>
          <li><strong>Consultor:</strong> ${ex.consultant || '-'} </li>
          <li><strong>Data:</strong> ${ex.date || '-'} </li>
          <li><strong>Usuário:</strong> ${ex.usuario || '-'} </li>
        `;
        show(dpPanel);
        setMsg(formMsg, 'error', 'Telefone já cadastrado.');
      } else if (resp.status === 401) {
        setMsg(formMsg, 'error', 'Sessão expirada ou não autenticado. Faça login.');
      } else if (resp.status === 403) {
        setMsg(formMsg, 'error', 'Permissão negada. Perfil deve ser viewer, editor ou admin.');
      } else {
        setMsg(formMsg, 'error', data?.error?.message || 'Falha ao cadastrar.');
      }
      return;
    }
    setMsg(formMsg, 'success', 'Contato cadastrado com sucesso!');
    $('name').value = '';
    $('phone').value = '';
    $('course').value = '';
    if (courseSelect) courseSelect.value = '';
    hide($('course'));
    $('consultant').value = '';
    if (consultantSelect) consultantSelect.value = '';
    hide($('consultant'));
  } catch (err) {
    setMsg(formMsg, 'error', 'Erro ao cadastrar contato.');
  }
});

// ===== Admin: listar contatos =====
$('loadListBtn').addEventListener('click', async () => {
  const adminMsg = $('adminMsg');
  const table = $('contactsTable');
  const tbody = table.querySelector('tbody');
  setMsg(adminMsg, '', ''); tbody.innerHTML = ''; hide(table);
  try {
    const resp = await apiFetch('/api/contacts/list');
    const data = await resp.json();
    if (!resp.ok) {
      setMsg(adminMsg, 'error', data?.error?.message || 'Falha ao listar.');
      return;
    }
    const items = data.items || [];
    items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${it.rowIndex}</td>
        <td>${it.name}</td>
        <td>${it.phone}</td>
        <td>${it.course}</td>
        <td>${it.consultant}</td>
        <td>${it.date}</td>
        <td>${it.usuario}</td>
        <td>${it.senha}</td>
      `;
      tbody.appendChild(tr);
    });
    show(table);
  } catch (err) {
    setMsg(adminMsg, 'error', 'Erro ao carregar lista.');
  }
});

// ===== Admin: conectar ao Google (OAuth) =====
$('connectGoogleBtn')?.addEventListener('click', async () => {
  const adminMsg = $('adminMsg');
  setMsg(adminMsg, '', '');
  try {
    const resp = await apiFetch('/api/google/auth-url');
    const data = await resp.json();
    if (!resp.ok || !data.url) {
      setMsg(adminMsg, 'error', data?.error?.message || 'Falha ao gerar URL de autorização.');
      return;
    }
    window.location.href = data.url;
  } catch (err) {
    setMsg(adminMsg, 'error', 'Erro ao iniciar autorização com o Google.');
  }
});

// ===== Capturar retorno OAuth (code) =====
(function handleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;
  const adminMsg = $('adminMsg');
  setMsg(adminMsg, '', '');
  apiFetch('/api/google/oauth/callback', {
    method: 'POST',
    body: JSON.stringify({ code })
  })
    .then(async (resp) => {
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setMsg(adminMsg, 'error', data?.error?.message || 'Falha ao concluir autorização com o Google.');
      } else {
        setMsg(adminMsg, 'success', 'Google conectado com sucesso.');
      }
    })
    .catch(() => {
      setMsg(adminMsg, 'error', 'Erro ao processar o retorno do Google.');
    })
    .finally(() => {
      // Limpa parâmetros da URL para evitar repetir a troca
      params.delete('code');
      params.delete('scope');
      params.delete('authuser');
      params.delete('prompt');
      const clean = window.location.origin + window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, document.title, clean);
    });
})();

// ===== Bootstrap =====
loadAuth();
updateUIAuth();