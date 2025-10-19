# Sistema de Cadastro de Contatos (Time Externo)

Este sistema permite que consultores registrem contatos diretamente em uma planilha do Google Sheets, com verificação de duplicidade por telefone, controle de acesso por perfis e feedback claro de erros.

## Recursos
- Interface para cadastro: nome, telefone, email e observações.
- Verificação de duplicidade por telefone em tempo real.
- Integração com Google Sheets (append sem sobrescrever dados).
- Metadados automáticos: quem registrou e data/hora.
- Controle de acesso por perfis: `viewer`, `editor`, `admin`.
- Tratamento de erros amigável.

## Pré-requisitos
- Node.js 18+ e npm.
- Conta no Google Cloud com API Google Sheets ativada.
- Service Account com chave JSON.
- Planilha criada no Google Sheets e compartilhada com o email da Service Account.

## Configuração
1. Clone ou baixe este projeto.
2. Crie o arquivo `.env` baseado no `.env.example`:
   ```
   PORT=3000
   JWT_SECRET=troque_este_segredo
   GOOGLE_SHEETS_SPREADSHEET_ID=<ID da sua planilha>
   GOOGLE_SHEETS_SHEET_TITLE=Contacts
   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/service-account.json
   ```
3. Coloque o arquivo JSON da Service Account em `./credentials/service-account.json`.
4. Abra sua planilha no Google Sheets, copie o `Spreadsheet ID` (parte entre `/d/` e `/edit` na URL) e configure em `GOOGLE_SHEETS_SPREADSHEET_ID`.
5. Compartilhe a planilha com o email da Service Account (lembre-se de dar permissão de edição).

## Instalação
```bash
npm install
```

## Executando (desenvolvimento)
```bash
npm run dev
```
Acesse: `http://localhost:3000/`

## Perfis e usuários de exemplo
- Arquivo: `config/users.json`
- Usuários padrão:
  - admin / admin123 (admin)
  - ana / ana123 (editor)
  - carlos / carlos123 (viewer)
- Altere conforme necessário. Em produção, use armazenamento seguro e senha com hash.

## Fluxo de uso
1. Faça login.
2. Preencha o formulário do contato.
3. Clique em "Verificar duplicidade" (opcional; o sistema também verifica ao cadastrar).
4. Se não houver duplicidade, clique em "Cadastrar".
5. Se você for `admin`, use o painel para listar contatos.

## Estrutura das colunas na planilha
A aba `Contacts` deve conter cabeçalhos (criados automaticamente se vazio):
```
Name | Phone | Email | Notes | RegisteredBy | RegisteredAt
```
- `Phone` é armazenado apenas com dígitos (limpeza automática).
- `RegisteredAt` usa ISO 8601 (UTC).

## Erros comuns e solução
- "GOOGLE_SHEETS_SPREADSHEET_ID não configurado": crie `.env` com ID correto.
- "Arquivo de chave de serviço não encontrado": coloque o JSON em `./credentials/service-account.json` e confirme o caminho.
- "Permissão negada": seu perfil não permite a ação; entre com um usuário `editor` ou `admin`.
- "Falha ao consultar/Adicionar planilha": verifique se a planilha está compartilhada com a Service Account e se a API está habilitada.

## Segurança e próximos passos
- Trocar `JWT_SECRET` por um valor seguro em produção.
- Implementar hash de senha e armazenamento seguro.
- Adicionar edição de registros (ex.: endpoint `update`) com UI específica.
- Logs estruturados e retentativas na comunicação com a API.

## Licença
Uso interno. Ajuste conforme sua política.

## Deploy no Vercel
- Conecte o repositório GitHub `Diogecson/CAPTACAO_EXTERNO` ao Vercel.
- Defina variáveis de ambiente no projeto Vercel:
  - `POSTGRES_URL` (recomendado; banco nativo Vercel Postgres)
  - `JWT_SECRET`
  - `ALLOW_PUBLIC_CONTACTS` (opcional; `true` permite uso sem login para verificar/cadastrar)
  - `ALLOW_PUBLIC_REGISTRATION` (opcional; `true` permite criar conta `viewer`)
  - (Fallback) Google Sheets: `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_SHEET_TITLE` (padrão `Contacts`), `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` OU OAuth (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_TOKEN_JSON`).
- A estrutura usa funções serverless em `api/` e arquivos estáticos em `public/`.
- O arquivo `vercel.json` faz rewrites para servir `index.html`, `app.js` e `styles.css` na raiz.
- Após configurar, o deploy ocorre automaticamente a cada push no `main`. Para deploy manual, use o dashboard da Vercel e clique em "Deploy".

### Observações
- Em produção, priorize `POSTGRES_URL`; se presente, o app usa Postgres e ignora Google Sheets.
- Se optar por Google Sheets, use `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` (Service Account) e compartilhe a planilha com o `client_email` como Editor. OAuth é opcional e exige `GOOGLE_OAUTH_TOKEN_JSON`.
- Persistência de arquivos em Vercel é efêmera; não confie em arquivos gerados em runtime. Guarde usuários em `config/users.json` no repositório ou em banco de dados.