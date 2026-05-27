import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sqlite } from '../../db/connection.js';
import { AppError } from '../../utils/errors.js';
import { getJwtSecret } from './admin.auth.js';
import { deriveAdminPassword } from './admin.password.js';
import type { AdminLoginInput } from './admin.schema.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

type CountRow = { total: number };

function optionalEnv(value: string | undefined) {
  return value && value.trim().length > 0 ? value : undefined;
}

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page ?? DEFAULT_PAGE) || DEFAULT_PAGE, 1);
  const perPage = Math.min(
    Math.max(Number(query.perPage ?? DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE, 1),
    MAX_PER_PAGE,
  );

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
  };
}

function count(sql: string, params: unknown[] = []) {
  return (sqlite.prepare(sql).get(...params) as CountRow).total;
}

function groupedCounts(table: string, column: string) {
  return sqlite
    .prepare(`SELECT ${column} AS key, COUNT(*) AS total FROM ${table} GROUP BY ${column}`)
    .all() as Array<{ key: string; total: number }>;
}

export async function loginAdmin(input: AdminLoginInput) {
  const adminEmail = optionalEnv(process.env.ADMIN_EMAIL)?.toLowerCase();
  const adminPassword = optionalEnv(process.env.ADMIN_PASSWORD);
  const adminPasswordHash = optionalEnv(process.env.ADMIN_PASSWORD_HASH);
  const adminPasswordDeriveSecret = optionalEnv(process.env.ADMIN_PASSWORD_DERIVE_SECRET);

  if (!adminEmail || (!adminPassword && !adminPasswordHash && !adminPasswordDeriveSecret)) {
    throw new AppError('Credenciais administrativas não configuradas', 500);
  }

  if (input.email !== adminEmail) {
    throw new AppError('Credenciais administrativas inválidas', 401);
  }

  const derivedPassword =
    adminPasswordDeriveSecret && adminEmail
      ? deriveAdminPassword(adminEmail, adminPasswordDeriveSecret)
      : undefined;

  const passwordMatches = adminPasswordHash
    ? await bcrypt.compare(input.password, adminPasswordHash)
    : input.password === (adminPassword ?? derivedPassword);

  if (!passwordMatches) {
    throw new AppError('Credenciais administrativas inválidas', 401);
  }

  const signOptions: jwt.SignOptions = {
    expiresIn: (process.env.ADMIN_JWT_EXPIRES_IN ?? '2h') as jwt.SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(
    {
      sub: 'admin',
      email: adminEmail,
      scope: 'admin',
    },
    getJwtSecret(),
    signOptions,
  );

  return {
    accessToken,
    admin: {
      email: adminEmail,
      scope: 'admin',
    },
  };
}

export function getAdminOverview() {
  return {
    users: {
      total: count('SELECT COUNT(*) AS total FROM users'),
      clients: count("SELECT COUNT(*) AS total FROM users WHERE role = 'client'"),
      providers: count("SELECT COUNT(*) AS total FROM users WHERE role = 'provider'"),
      active: count('SELECT COUNT(*) AS total FROM users WHERE is_active = 1'),
      verified: count('SELECT COUNT(*) AS total FROM users WHERE is_verified = 1'),
      byRole: groupedCounts('users', 'role'),
    },
    providers: {
      total: count('SELECT COUNT(*) AS total FROM provider_profiles'),
      verified: count('SELECT COUNT(*) AS total FROM provider_profiles WHERE is_verified = 1'),
      withCategory: count('SELECT COUNT(*) AS total FROM provider_profiles WHERE category_id IS NOT NULL'),
    },
    listings: {
      total: count('SELECT COUNT(*) AS total FROM listings'),
      byStatus: groupedCounts('listings', 'status'),
    },
    contracts: {
      total: count('SELECT COUNT(*) AS total FROM contracts'),
      byStatus: groupedCounts('contracts', 'status'),
    },
    messages: {
      total: count('SELECT COUNT(*) AS total FROM messages'),
      unread: count('SELECT COUNT(*) AS total FROM messages WHERE is_read = 0'),
    },
    reviews: {
      total: count('SELECT COUNT(*) AS total FROM reviews'),
      public: count('SELECT COUNT(*) AS total FROM reviews WHERE is_public = 1'),
    },
  };
}

export function getAdminObservability() {
  const pageCount = sqlite.pragma('page_count', { simple: true }) as number;
  const pageSize = sqlite.pragma('page_size', { simple: true }) as number;

  return {
    api: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      node: process.version,
      environment: process.env.NODE_ENV ?? 'development',
    },
    database: {
      status: 'ok',
      journalMode: sqlite.pragma('journal_mode', { simple: true }),
      foreignKeys: sqlite.pragma('foreign_keys', { simple: true }) === 1,
      pageCount,
      pageSize,
      approximateSizeBytes: pageCount * pageSize,
      migrations: sqlite.prepare('SELECT id, applied_at AS appliedAt FROM migrations ORDER BY id').all(),
    },
  };
}

export function listAdminUsers(query: Record<string, unknown>) {
  const { page, perPage, offset } = parsePagination(query);
  const role = typeof query.role === 'string' ? query.role : undefined;
  const where = role ? 'WHERE role = ?' : '';
  const params = role ? [role] : [];

  const data = sqlite
    .prepare(
      `SELECT id, name, email, role, avatar_url AS avatarUrl, bio, phone,
              is_verified AS isVerified, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, perPage, offset);

  const total = count(`SELECT COUNT(*) AS total FROM users ${where}`, params);

  return { data, meta: { page, perPage, total } };
}

export function listAdminProviders(query: Record<string, unknown>) {
  const { page, perPage, offset } = parsePagination(query);

  const data = sqlite
    .prepare(
      `SELECT p.id, p.user_id AS userId, u.name AS userName, u.email AS userEmail,
              p.company_name AS companyName, p.display_name AS displayName,
              p.description, p.location, p.website, p.average_rating AS averageRating,
              p.total_reviews AS totalReviews, p.total_contracts AS totalContracts,
              p.is_verified AS isVerified, c.name AS categoryName,
              p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM provider_profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(perPage, offset);

  const total = count('SELECT COUNT(*) AS total FROM provider_profiles');

  return { data, meta: { page, perPage, total } };
}

export function listAdminListings(query: Record<string, unknown>) {
  const { page, perPage, offset } = parsePagination(query);

  const data = sqlite
    .prepare(
      `SELECT l.id, l.provider_id AS providerId, p.display_name AS providerName,
              l.title, l.price, l.price_type AS priceType, l.price_currency AS priceCurrency,
              l.status, l.views, c.name AS categoryName,
              l.created_at AS createdAt, l.updated_at AS updatedAt
       FROM listings l
       JOIN provider_profiles p ON p.id = l.provider_id
       LEFT JOIN categories c ON c.id = l.category_id
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(perPage, offset);

  const total = count('SELECT COUNT(*) AS total FROM listings');

  return { data, meta: { page, perPage, total } };
}

export function listAdminContracts(query: Record<string, unknown>) {
  const { page, perPage, offset } = parsePagination(query);

  const data = sqlite
    .prepare(
      `SELECT ct.id, ct.title, ct.status, ct.agreed_price AS agreedPrice, ct.currency,
              client.name AS clientName, client.email AS clientEmail,
              provider_user.name AS providerUserName, provider_user.email AS providerUserEmail,
              p.display_name AS providerName,
              ct.created_at AS createdAt, ct.updated_at AS updatedAt
       FROM contracts ct
       JOIN users client ON client.id = ct.client_id
       JOIN provider_profiles p ON p.id = ct.provider_id
       JOIN users provider_user ON provider_user.id = p.user_id
       ORDER BY ct.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(perPage, offset);

  const total = count('SELECT COUNT(*) AS total FROM contracts');

  return { data, meta: { page, perPage, total } };
}
