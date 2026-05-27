# SPEC: Baito — Backend SaaS de Gerenciamento de Contratações

## Visão Geral

SaaS de marketplace de serviços onde:
- **Clientes** buscam e contratam prestadores de serviço
- **Prestadores** criam perfis, publicam anúncios e gerenciam contratos
- Um usuário pode ser cliente e prestador simultaneamente

Stack: **Express.js + SQLite + Drizzle ORM + Docker Compose**

---

## Stack e Dependências

```json
{
  "dependencies": {
    "express": "^4.18",
    "drizzle-orm": "^0.30",
    "better-sqlite3": "^9.4",
    "bcryptjs": "^2.4",
    "jsonwebtoken": "^9.0",
    "zod": "^3.22",
    "helmet": "^7.1",
    "cors": "^2.8",
    "express-rate-limit": "^7.2",
    "uuid": "^9.0",
    "dotenv": "^16.4",
    "morgan": "^1.10"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20",
    "@types/better-sqlite3": "^7.6",
    "tsx": "^4.7",
    "typescript": "^5.3"
  }
}
```

---

## Estrutura de Diretórios

```
/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── drizzle.config.ts
├── src/
│   ├── index.ts                  # Entry point
│   ├── db/
│   │   ├── connection.ts         # Drizzle + better-sqlite3 setup
│   │   ├── schema/
│   │   │   ├── users.ts
│   │   │   ├── providers.ts
│   │   │   ├── listings.ts
│   │   │   ├── contracts.ts
│   │   │   ├── messages.ts
│   │   │   ├── reviews.ts
│   │   │   ├── categories.ts
│   │   │   └── refreshTokens.ts
│   │   └── index.ts              # Re-exports all schemas
│   ├── middleware/
│   │   ├── auth.ts               # JWT verify middleware
│   │   ├── validate.ts           # Zod validation middleware
│   │   ├── rateLimiter.ts        # Per-route rate limiters
│   │   └── errorHandler.ts       # Global error handler
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts    # Zod schemas
│   │   ├── users/
│   │   │   ├── users.router.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── providers/
│   │   │   ├── providers.router.ts
│   │   │   ├── providers.controller.ts
│   │   │   └── providers.service.ts
│   │   ├── listings/
│   │   │   ├── listings.router.ts
│   │   │   ├── listings.controller.ts
│   │   │   ├── listings.service.ts
│   │   │   └── listings.schema.ts
│   │   ├── contracts/
│   │   │   ├── contracts.router.ts
│   │   │   ├── contracts.controller.ts
│   │   │   ├── contracts.service.ts
│   │   │   └── contracts.schema.ts
│   │   ├── messages/
│   │   │   ├── messages.router.ts
│   │   │   ├── messages.controller.ts
│   │   │   ├── messages.service.ts
│   │   │   └── messages.schema.ts
│   │   └── reviews/
│   │       ├── reviews.router.ts
│   │       ├── reviews.controller.ts
│   │       └── reviews.service.ts
│   └── utils/
│       ├── jwt.ts
│       ├── hash.ts
│       └── errors.ts
├── migrations/                   # Gerado pelo drizzle-kit
└── seed.ts                       # Dados iniciais (categorias)
```

---

## Schema do Banco de Dados (Drizzle)

### `src/db/schema/users.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                          // UUID v4
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['client', 'provider', 'both'] }).notNull().default('client'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  phone: text('phone'),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### `src/db/schema/refreshTokens.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),     // bcrypt hash do refresh token
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

### `src/db/schema/categories.ts`

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),                                   // nome de ícone (ex: lucide)
  description: text('description'),
});
```

### `src/db/schema/providers.ts`

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { categories } from './categories';

export const providerProfiles = sqliteTable('provider_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name'),                    // null = pessoa física
  displayName: text('display_name').notNull(),
  description: text('description').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  location: text('location'),
  website: text('website'),
  cnpj: text('cnpj'),                                  // criptografado na app layer
  cpf: text('cpf'),                                    // criptografado na app layer
  averageRating: real('average_rating').default(0),
  totalReviews: integer('total_reviews').default(0),
  totalContracts: integer('total_contracts').default(0),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type NewProviderProfile = typeof providerProfiles.$inferInsert;
```

### `src/db/schema/listings.ts`

```typescript
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { providerProfiles } from './providers';
import { categories } from './categories';

export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => providerProfiles.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  price: real('price'),
  priceType: text('price_type', {
    enum: ['fixed', 'hourly', 'daily', 'negotiable']
  }).notNull().default('negotiable'),
  priceCurrency: text('price_currency').notNull().default('BRL'),
  tags: text('tags'),                                   // JSON array serializado
  status: text('status', {
    enum: ['active', 'paused', 'deleted']
  }).notNull().default('active'),
  views: integer('views').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const listingImages = sqliteTable('listing_images', {
  id: text('id').primaryKey(),
  listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  altText: text('alt_text'),
  order: integer('order').notNull().default(0),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
```

### `src/db/schema/contracts.ts`

```typescript
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { listings } from './listings';
import { providerProfiles } from './providers';

export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => users.id),
  providerId: text('provider_id').notNull().references(() => providerProfiles.id),
  listingId: text('listing_id').references(() => listings.id),  // null se contrato sem anúncio
  title: text('title').notNull(),
  description: text('description'),
  agreedPrice: real('agreed_price'),
  currency: text('currency').notNull().default('BRL'),
  status: text('status', {
    enum: [
      'pending',        // cliente enviou proposta
      'accepted',       // prestador aceitou
      'in_progress',    // trabalho iniciado
      'completed',      // prestador marcou como concluído
      'confirmed',      // cliente confirmou conclusão
      'cancelled',      // cancelado por qualquer parte
      'disputed'        // em disputa
    ]
  }).notNull().default('pending'),
  cancelledBy: text('cancelled_by'),                    // user_id
  cancelReason: text('cancel_reason'),
  scheduledAt: text('scheduled_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
```

### `src/db/schema/messages.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { contracts } from './contracts';

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id),
  receiverId: text('receiver_id').notNull().references(() => users.id),
  contractId: text('contract_id').references(() => contracts.id), // null = contato direto (pré-contrato)
  content: text('content').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type Message = typeof messages.$inferSelect;
```

### `src/db/schema/reviews.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { contracts } from './contracts';

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  contractId: text('contract_id').notNull().unique().references(() => contracts.id), // 1 review por contrato
  reviewerId: text('reviewer_id').notNull().references(() => users.id),
  reviewedId: text('reviewed_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),                  // 1–5, CONSTRAINT na app layer
  comment: text('comment'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

---

## Migrations

### Primeira migration — `migrations/0001_initial.sql`

```sql
-- Habilitar foreign keys (SQLite requer por sessão)
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- CATEGORIAS
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT
);

-- USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'provider', 'both')),
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- PERFIS DE PRESTADOR
CREATE TABLE IF NOT EXISTS provider_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  location TEXT,
  website TEXT,
  cnpj TEXT,
  cpf TEXT,
  average_rating REAL DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_contracts INTEGER DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id ON provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_category ON provider_profiles(category_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_rating ON provider_profiles(average_rating DESC);

-- ANÚNCIOS
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL,
  price_type TEXT NOT NULL DEFAULT 'negotiable'
    CHECK (price_type IN ('fixed', 'hourly', 'daily', 'negotiable')),
  price_currency TEXT NOT NULL DEFAULT 'BRL',
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'deleted')),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listings_provider ON listings(provider_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);

-- IMAGENS DE ANÚNCIOS
CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);

-- CONTRATOS
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES users(id),
  provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
  listing_id TEXT REFERENCES listings(id),
  title TEXT NOT NULL,
  description TEXT,
  agreed_price REAL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'in_progress',
    'completed', 'confirmed', 'cancelled', 'disputed'
  )),
  cancelled_by TEXT,
  cancel_reason TEXT,
  scheduled_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_provider ON contracts(provider_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_listing ON contracts(listing_id);

-- MENSAGENS
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  contract_id TEXT REFERENCES contracts(id),
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_contract ON messages(contract_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(sender_id, receiver_id, created_at DESC);

-- AVALIAÇÕES
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL UNIQUE REFERENCES contracts(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  reviewed_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_reviews_contract ON reviews(contract_id);

-- TRIGGER: updated_at automático
CREATE TRIGGER IF NOT EXISTS users_updated_at
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS provider_profiles_updated_at
  AFTER UPDATE ON provider_profiles
  BEGIN
    UPDATE provider_profiles SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS listings_updated_at
  AFTER UPDATE ON listings
  BEGIN
    UPDATE listings SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS contracts_updated_at
  AFTER UPDATE ON contracts
  BEGIN
    UPDATE contracts SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- TRIGGER: recalcular rating do prestador após review
CREATE TRIGGER IF NOT EXISTS update_provider_rating_on_insert
  AFTER INSERT ON reviews
  BEGIN
    UPDATE provider_profiles SET
      average_rating = (
        SELECT ROUND(AVG(CAST(r.rating AS REAL)), 2)
        FROM reviews r
        JOIN contracts c ON r.contract_id = c.id
        WHERE c.provider_id = provider_profiles.id AND r.is_public = 1
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM reviews r
        JOIN contracts c ON r.contract_id = c.id
        WHERE c.provider_id = provider_profiles.id AND r.is_public = 1
      )
    WHERE id = (
      SELECT c.provider_id FROM contracts c WHERE c.id = NEW.contract_id
    );
  END;

-- TRIGGER: incrementar total_contracts ao confirmar contrato
CREATE TRIGGER IF NOT EXISTS increment_provider_contracts
  AFTER UPDATE ON contracts
  WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
  BEGIN
    UPDATE provider_profiles
      SET total_contracts = total_contracts + 1
      WHERE id = NEW.provider_id;
  END;
```

### Seed de categorias — `migrations/0002_seed_categories.sql`

```sql
INSERT OR IGNORE INTO categories (id, name, slug, icon, description) VALUES
  ('cat_01', 'Tecnologia da Informação', 'ti', 'monitor', 'Desenvolvimento de software, suporte, infraestrutura'),
  ('cat_02', 'Design e Criação', 'design', 'pen-tool', 'Design gráfico, UI/UX, identidade visual'),
  ('cat_03', 'Marketing Digital', 'marketing', 'trending-up', 'SEO, redes sociais, gestão de tráfego'),
  ('cat_04', 'Jurídico', 'juridico', 'scale', 'Advocacia, consultoria jurídica, contratos'),
  ('cat_05', 'Contabilidade e Finanças', 'contabilidade', 'calculator', 'Contabilidade, auditoria, planejamento financeiro'),
  ('cat_06', 'Construção e Reformas', 'construcao', 'hard-hat', 'Arquitetura, engenharia, reformas residenciais'),
  ('cat_07', 'Saúde e Bem-estar', 'saude', 'heart', 'Nutrição, psicologia, personal trainer'),
  ('cat_08', 'Educação e Treinamento', 'educacao', 'book-open', 'Aulas particulares, cursos, treinamentos corporativos'),
  ('cat_09', 'Eventos e Entretenimento', 'eventos', 'music', 'Fotografia, DJ, buffet, organização de eventos'),
  ('cat_10', 'Beleza e Estética', 'beleza', 'scissors', 'Cabeleireiro, maquiagem, estética');
```

---

## Configuração Docker

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache python3 make g++

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/migrations ./migrations

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  api:
    build: .
    container_name: servicohub_api
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: /app/data/servicohub.db
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_EXPIRES_IN: ${JWT_ACCESS_EXPIRES_IN:-15m}
      JWT_REFRESH_EXPIRES_IN: ${JWT_REFRESH_EXPIRES_IN:-7d}
      BCRYPT_ROUNDS: ${BCRYPT_ROUNDS:-12}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:5173}
    volumes:
      - sqlite_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  sqlite_data:
    driver: local
```

### `.env.example`

```env
PORT=3000
DATABASE_URL=./data/servicohub.db

# GERE COM: openssl rand -hex 64
JWT_SECRET=seu_jwt_secret_muito_longo_e_aleatorio_aqui
JWT_REFRESH_SECRET=seu_refresh_secret_diferente_do_access_aqui
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
```

---

## Configuração Drizzle

### `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default {
  schema: './src/db/schema/*',
  out: './migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './data/servicohub.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

---

## Rotas da API

### Autenticação — `/api/auth`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/register` | Cadastro de usuário | ❌ |
| POST | `/login` | Login, retorna access + refresh token | ❌ |
| POST | `/refresh` | Troca refresh token por novo access token | ❌ |
| POST | `/logout` | Invalida refresh token | ✅ |
| POST | `/logout-all` | Invalida todos os refresh tokens do usuário | ✅ |

### Usuários — `/api/users`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/me` | Perfil do usuário autenticado | ✅ |
| PATCH | `/me` | Atualiza nome, bio, avatar, telefone | ✅ |
| PATCH | `/me/password` | Troca senha (exige senha atual) | ✅ |
| GET | `/:id` | Perfil público de qualquer usuário | ❌ |

### Prestadores — `/api/providers`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/` | Cria perfil de prestador (muda role para provider/both) | ✅ |
| GET | `/` | Lista prestadores com filtros (categoria, localização, rating) | ❌ |
| GET | `/:id` | Perfil público de prestador com anúncios e avaliações | ❌ |
| PATCH | `/me` | Atualiza perfil do prestador autenticado | ✅ Provider |

### Anúncios — `/api/listings`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/` | Cria anúncio | ✅ Provider |
| GET | `/` | Lista anúncios (busca, filtro, paginação) | ❌ |
| GET | `/:id` | Detalhe do anúncio (incrementa views) | ❌ |
| PATCH | `/:id` | Atualiza anúncio (apenas dono) | ✅ Provider |
| DELETE | `/:id` | Soft delete do anúncio | ✅ Provider |

### Contratos — `/api/contracts`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/` | Cliente cria proposta de contrato | ✅ Client |
| GET | `/` | Lista contratos do usuário (como cliente ou prestador) | ✅ |
| GET | `/:id` | Detalhe do contrato (apenas partes envolvidas) | ✅ |
| PATCH | `/:id/accept` | Prestador aceita proposta | ✅ Provider |
| PATCH | `/:id/start` | Prestador inicia trabalho | ✅ Provider |
| PATCH | `/:id/complete` | Prestador marca como concluído | ✅ Provider |
| PATCH | `/:id/confirm` | Cliente confirma conclusão | ✅ Client |
| PATCH | `/:id/cancel` | Cancela contrato (qualquer parte, com motivo) | ✅ |

### Mensagens — `/api/messages`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/` | Envia mensagem (com ou sem contract_id) | ✅ |
| GET | `/conversations` | Lista conversas únicas do usuário | ✅ |
| GET | `/conversations/:userId` | Histórico de mensagens com usuário específico | ✅ |
| PATCH | `/conversations/:userId/read` | Marca mensagens como lidas | ✅ |

### Avaliações — `/api/reviews`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/` | Cria avaliação (apenas após contrato confirmed) | ✅ |
| GET | `/provider/:providerId` | Lista avaliações públicas de um prestador | ❌ |

### Categorias — `/api/categories`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/` | Lista todas as categorias | ❌ |

### Health — `/health`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status da API e banco |

---

## Segurança — Implementação Obrigatória

### Autenticação JWT

```
Access Token:  JWT assinado com JWT_SECRET, expira em 15min
Refresh Token: UUID opaco, armazenado como bcrypt hash no banco, expira em 7 dias

Fluxo:
1. Login → emite access + refresh token
2. Access expira → client usa refresh token em POST /auth/refresh
3. Refresh válido → novo access token emitido (refresh rotation opcional)
4. Logout → deleta refresh token do banco
```

### Password Hashing

```typescript
// utils/hash.ts
import bcrypt from 'bcryptjs';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12');

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
```

### Middleware de Segurança (aplicar em ordem)

```typescript
// src/index.ts — ordem dos middlewares
app.use(helmet());                    // Headers de segurança
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10kb' })); // Limitar body size
app.use(morgan('combined'));

// Rate limiters por rota (ver abaixo)
```

### Rate Limiting

```typescript
// middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                     // máx 10 tentativas de auth
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minuto
  max: 100,
  message: { error: 'Rate limit excedido.' },
});

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas mensagens enviadas.' },
});
```

### Validação de Input (Zod)

```typescript
// middleware/validate.ts
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;  // dados sanitizados
    next();
  };
```

### Exemplos de Schemas Zod

```typescript
// modules/auth/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .max(72)
    .regex(/[A-Z]/, 'Precisa de ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Precisa de ao menos um número'),
  role: z.enum(['client', 'provider']).default('client'),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

// modules/listings/listings.schema.ts
export const createListingSchema = z.object({
  title: z.string().min(5).max(100).trim(),
  description: z.string().min(20).max(5000).trim(),
  categoryId: z.string().uuid().optional(),
  price: z.number().positive().optional(),
  priceType: z.enum(['fixed', 'hourly', 'daily', 'negotiable']).default('negotiable'),
  tags: z.array(z.string().max(30)).max(10).optional(),
});
```

### Proteção contra SQL Injection

**Drizzle ORM usa queries parametrizadas por padrão** — nunca use `sql` template literal com input de usuário diretamente. Nunca construa queries com concatenação de strings.

```typescript
// ✅ CORRETO — Drizzle ORM parametriza automaticamente
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, userInputEmail))
  .get();

// ❌ ERRADO — NUNCA faça isso
const user = await db.run(sql.raw(`SELECT * FROM users WHERE email = '${userInputEmail}'`));
```

### Auth Middleware

```typescript
// middleware/auth.ts
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;      // user id
  role: string;
  iat: number;
  exp: number;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso ausente' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.some(r => req.user?.role === r || req.user?.role === 'both')) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }
    next();
  };
```

### Global Error Handler

```typescript
// middleware/errorHandler.ts
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Nunca expor stack traces em produção
  const isDev = process.env.NODE_ENV === 'development';
  
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
  
  // Erros conhecidos da aplicação
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor',
    ...(isDev && { details: err.message, stack: err.stack }),
  });
};

// utils/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

---

## Regras de Negócio Importantes

1. **Perfil de prestador**: Usuário com `role: 'client'` que cria um perfil de prestador tem `role` atualizado para `'both'`
2. **Contrato**: Cliente não pode contratar a si mesmo; apenas o cliente do contrato pode confirmar a conclusão
3. **Review**: Só é possível criar avaliação para contratos com `status: 'confirmed'`; apenas uma review por contrato; quem avalia é sempre o cliente avaliando o prestador
4. **Mensagens**: Qualquer usuário autenticado pode iniciar conversa com qualquer prestador; mensagens dentro de contratos ficam vinculadas ao `contract_id`
5. **Anúncio**: Soft delete (`status: 'deleted'`) — jamais deletar fisicamente; contratos vinculados ao anúncio devem continuar existindo
6. **Views do anúncio**: Incrementar `views` em `GET /api/listings/:id` sem autenticação necessária; usar `UPDATE listings SET views = views + 1` direto

---

## Formato de Resposta Padrão

```json
// Sucesso
{
  "data": { },
  "meta": { "page": 1, "perPage": 20, "total": 150 }
}

// Erro
{
  "error": "Mensagem legível",
  "details": { "campo": ["erro de validação"] }
}

// Auth
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "uuid-opaco",
    "user": { "id": "...", "name": "...", "email": "...", "role": "..." }
  }
}
```

---

## Checklist de Implementação

- [ ] Setup inicial: `package.json`, `tsconfig.json`, `drizzle.config.ts`
- [ ] `src/db/connection.ts` com `better-sqlite3` + `PRAGMA foreign_keys = ON`
- [ ] Schemas Drizzle (`src/db/schema/*`)
- [ ] Rodar migrations via `drizzle-kit push` ou executar o SQL diretamente
- [ ] Seed de categorias
- [ ] `src/index.ts` com todos os middlewares de segurança na ordem correta
- [ ] Módulo `auth` completo (register, login, refresh, logout)
- [ ] Módulo `users` (me, update, public profile)
- [ ] Módulo `providers` (create profile, list, get, update)
- [ ] Módulo `listings` (CRUD com soft delete, search com paginação offset-based)
- [ ] Módulo `contracts` (state machine de status)
- [ ] Módulo `messages` (envio + listagem de conversas)
- [ ] Módulo `reviews` (criar + listar por prestador)
- [ ] `GET /health` com status do DB
- [ ] Dockerfile + docker-compose.yml
- [ ] `.env.example` com todas as variáveis necessárias
