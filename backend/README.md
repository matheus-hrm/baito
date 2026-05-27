# Baito Backend

Backend HTTP para o Baito, um marketplace de contratação de serviços. A API usa Express, SQLite, Drizzle ORM e Docker Compose com imagem final distroless.

## Stack

- Node.js 20 no container
- Express 4
- SQLite com `better-sqlite3`
- Drizzle ORM
- TypeScript
- Zod para validação
- JWT para sessão administrativa
- Docker multi-stage com runtime `gcr.io/distroless/nodejs20-debian12:nonroot`

## Estrutura

```text
.
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── migrations/
│   ├── 0001_initial.sql
│   └── 0002_seed_categories.sql
├── src/
│   ├── app.ts
│   ├── index.ts
│   ├── db/
│   ├── middleware/
│   ├── modules/
│   │   ├── admin/
│   │   └── categories/
│   ├── scripts/
│   └── utils/
└── tests/
```

## Configuração

Crie um `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Variáveis principais:

```env
PORT=3000
DATABASE_URL=./data/baito.db

JWT_SECRET=gere_com_openssl_rand_hex_64
JWT_REFRESH_SECRET=gere_outro_secret_com_openssl_rand_hex_64
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ADMIN_EMAIL=admin@baito.local
ADMIN_PASSWORD_DERIVE_SECRET=gere_um_secret_longo_para_derivar_a_senha_admin
ADMIN_JWT_EXPIRES_IN=2h

BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
```

Gere secrets com:

```bash
openssl rand -hex 64
```

## Senha de Admin

O admin pode ser configurado de três formas. A ordem de prioridade é:

1. `ADMIN_PASSWORD_HASH`
2. `ADMIN_PASSWORD`
3. `ADMIN_PASSWORD_DERIVE_SECRET`

O modo recomendado é `ADMIN_PASSWORD_DERIVE_SECRET`. A senha não fica salva diretamente no `.env`; ela é derivada em runtime usando HMAC-SHA256 com o email admin.

Para imprimir a senha calculada localmente:

```bash
npm run admin:password
```

Depois use essa senha em:

```http
POST /api/admin/login
```

Exemplo:

```bash
curl -sS -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@baito.local","password":"SENHA_GERADA"}'
```

Para produção, também é possível usar um hash bcrypt:

```env
ADMIN_EMAIL=admin@baito.local
ADMIN_PASSWORD_HASH=$2b$12$...
```

Nesse caso, remova `ADMIN_PASSWORD` e `ADMIN_PASSWORD_DERIVE_SECRET`.

## Instalação Local

```bash
npm install
npm run db:migrate
npm run build
npm start
```

Servidor local:

```text
http://localhost:3000
```

Modo desenvolvimento:

```bash
npm run dev
```

## Docker Compose

Build:

```bash
docker compose build
```

Subir:

```bash
docker compose up -d
```

Logs:

```bash
docker compose logs -f api
```

Parar:

```bash
docker compose down
```

O Compose monta o banco em volume:

```text
sqlite_data:/app/data
```

No container, o banco fica em:

```text
/app/data/baito.db
```

## Migrations

As migrations SQL ficam em `migrations/`.

Rodar migrations:

```bash
npm run db:migrate
```

O migrator cria uma tabela `migrations` e aplica apenas arquivos ainda não aplicados. As migrations atuais são:

- `0001_initial.sql`: cria tabelas, índices e triggers
- `0002_seed_categories.sql`: insere categorias iniciais com UUID

## Testes

Teste inicial de banco:

```bash
npm run test:db
```

Esse teste valida:

- execução das migrations
- seed das 10 categorias
- formato UUID das categorias
- `PRAGMA foreign_keys = ON`
- `journal_mode = WAL`

Audit de dependências de produção:

```bash
npm audit --omit=dev
```

## Rotas Implementadas

### Health

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| GET | `/health` | Não | Verifica status da API e do banco |

Resposta:

```json
{
  "data": {
    "status": "ok",
    "database": "ok",
    "uptime": 10.5
  }
}
```

### Categorias

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| GET | `/api/categories` | Não | Lista categorias disponíveis |

Resposta:

```json
{
  "data": [
    {
      "id": "018f6b23-7c01-7000-8000-000000000001",
      "name": "Tecnologia da Informação",
      "slug": "ti",
      "icon": "monitor",
      "description": "Desenvolvimento de software, suporte, infraestrutura"
    }
  ]
}
```

### Admin

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/admin/login` | Não | Login administrativo |
| GET | `/api/admin/me` | Admin | Retorna a sessão administrativa atual |
| GET | `/api/admin/overview` | Admin | Retorna contadores gerais do sistema |
| GET | `/api/admin/observability` | Admin | Retorna métricas básicas da API e SQLite |
| GET | `/api/admin/users` | Admin | Lista usuários paginados |
| GET | `/api/admin/providers` | Admin | Lista prestadores paginados |
| GET | `/api/admin/listings` | Admin | Lista anúncios paginados |
| GET | `/api/admin/contracts` | Admin | Lista contratos paginados |

Login:

```bash
curl -sS -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@baito.local","password":"SENHA_ADMIN"}'
```

Resposta:

```json
{
  "data": {
    "accessToken": "jwt",
    "admin": {
      "email": "admin@baito.local",
      "scope": "admin"
    }
  }
}
```

Usar token:

```bash
curl -sS http://localhost:3000/api/admin/overview \
  -H "Authorization: Bearer TOKEN"
```

Paginação:

```text
GET /api/admin/users?page=1&perPage=20
GET /api/admin/providers?page=1&perPage=20
GET /api/admin/listings?page=1&perPage=20
GET /api/admin/contracts?page=1&perPage=20
```

Filtro atual em usuários:

```text
GET /api/admin/users?role=client
GET /api/admin/users?role=provider
```

## Rotas Planejadas

Essas rotas estão no contrato técnico do projeto, mas ainda não foram implementadas nesta primeira base.

### Autenticação de Usuário

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/auth/register` | Não | Cadastro de usuário |
| POST | `/api/auth/login` | Não | Login de usuário |
| POST | `/api/auth/refresh` | Não | Renova access token |
| POST | `/api/auth/logout` | Usuário | Invalida refresh token atual |
| POST | `/api/auth/logout-all` | Usuário | Invalida todos os refresh tokens do usuário |

### Usuários

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| GET | `/api/users/me` | Usuário | Perfil autenticado |
| PATCH | `/api/users/me` | Usuário | Atualiza dados básicos |
| PATCH | `/api/users/me/password` | Usuário | Troca senha |
| GET | `/api/users/:id` | Não | Perfil público |

### Prestadores

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/providers` | Usuário | Cria perfil de prestador |
| GET | `/api/providers` | Não | Lista prestadores |
| GET | `/api/providers/:id` | Não | Detalhe público do prestador |
| PATCH | `/api/providers/me` | Prestador | Atualiza perfil do prestador |

### Anúncios

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/listings` | Prestador | Cria anúncio |
| GET | `/api/listings` | Não | Lista anúncios |
| GET | `/api/listings/:id` | Não | Detalhe e incremento de views |
| PATCH | `/api/listings/:id` | Prestador dono | Atualiza anúncio |
| DELETE | `/api/listings/:id` | Prestador dono | Soft delete do anúncio |

### Contratos

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/contracts` | Cliente | Cria proposta |
| GET | `/api/contracts` | Usuário | Lista contratos do usuário |
| GET | `/api/contracts/:id` | Parte do contrato | Detalhe do contrato |
| PATCH | `/api/contracts/:id/accept` | Prestador | Aceita proposta |
| PATCH | `/api/contracts/:id/start` | Prestador | Inicia trabalho |
| PATCH | `/api/contracts/:id/complete` | Prestador | Marca como concluído |
| PATCH | `/api/contracts/:id/confirm` | Cliente | Confirma conclusão |
| PATCH | `/api/contracts/:id/cancel` | Parte do contrato | Cancela contrato |

### Mensagens

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/messages` | Usuário | Envia mensagem |
| GET | `/api/messages/conversations` | Usuário | Lista conversas |
| GET | `/api/messages/conversations/:userId` | Usuário | Histórico com usuário |
| PATCH | `/api/messages/conversations/:userId/read` | Usuário | Marca mensagens como lidas |

### Avaliações

| Método | Rota | Auth | Descrição |
|---|---|---:|---|
| POST | `/api/reviews` | Usuário | Cria avaliação |
| GET | `/api/reviews/provider/:providerId` | Não | Lista avaliações públicas do prestador |

## Modelo de Resposta

Sucesso:

```json
{
  "data": {}
}
```

Sucesso com paginação:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 0
  }
}
```

Erro:

```json
{
  "error": "Mensagem legível",
  "details": {}
}
```

## Segurança Técnica

- `helmet` habilitado globalmente
- `cors` configurável por `CORS_ORIGIN`
- `express.json` limitado a `10kb`
- rate limit global de API
- rate limit preparado para auth e mensagens
- SQLite com `foreign_keys = ON`
- SQLite com WAL
- queries administrativas usam prepared statements
- runtime Docker sem shell e sem pacote manager via distroless
- container final roda como usuário `nonroot`

## Comandos Úteis

```bash
npm run build
npm run db:migrate
npm run test:db
npm run admin:password
npm audit --omit=dev
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f api
docker compose down
```
