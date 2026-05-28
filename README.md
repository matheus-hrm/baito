# Baito

Marketplace de servicos com frontend React/Vite e backend Express/SQLite.

## Rodar Com Docker Compose

Crie um `.env` na raiz a partir do exemplo, se quiser trocar portas ou secrets:

```bash
cp .env.example .env
```

Suba frontend e backend:

```bash
docker compose up --build
```

URLs locais:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/health`

O banco SQLite fica no volume Docker `sqlite_data` e e montado no container da API em `/app/data/baito.db`.

## Configuracao

Variaveis principais da raiz:

```env
API_PORT=3000
FRONTEND_PORT=5173
FRONTEND_API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

`FRONTEND_API_URL` e usado no build do Vite. Como o codigo roda no navegador, esse valor precisa ser uma URL acessivel pelo browser, nao o nome interno do servico Docker.

Secrets principais:

```env
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ADMIN_EMAIL=admin@baito.local
ADMIN_PASSWORD_DERIVE_SECRET=...
```

Para imprimir a senha admin derivada localmente:

```bash
cd backend
npm run admin:password
```

## Rodar Sem Docker

Backend:

```bash
cd backend
npm install
npm run db:migrate
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Comandos De Validacao

Backend:

```bash
cd backend
npm run build
npm run test:db
```

Frontend:

```bash
cd frontend
npm run build
npm run lint
```

## Estrutura

- `docker-compose.yml`: orquestra API, frontend e volume SQLite.
- `.env.example`: exemplo centralizado para o compose da raiz.
- `backend/`: API Express, migrations SQLite, auth, admin e regras de negocio.
- `frontend/`: aplicacao React/Vite servida em producao por Nginx.
