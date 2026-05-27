UPDATE users SET role = 'provider' WHERE role = 'both';

CREATE TRIGGER IF NOT EXISTS reject_users_role_both_insert
  BEFORE INSERT ON users
  WHEN NEW.role = 'both'
  BEGIN
    SELECT RAISE(ABORT, 'users.role cannot be both');
  END;

CREATE TRIGGER IF NOT EXISTS reject_users_role_both_update
  BEFORE UPDATE OF role ON users
  WHEN NEW.role = 'both'
  BEGIN
    SELECT RAISE(ABORT, 'users.role cannot be both');
  END;
