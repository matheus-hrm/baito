PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT
);

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

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

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

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);

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
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

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

CREATE TRIGGER IF NOT EXISTS increment_provider_contracts
  AFTER UPDATE ON contracts
  WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
  BEGIN
    UPDATE provider_profiles
      SET total_contracts = total_contracts + 1
      WHERE id = NEW.provider_id;
  END;
