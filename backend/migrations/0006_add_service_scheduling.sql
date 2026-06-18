ALTER TABLE contracts ADD COLUMN schedule_status TEXT NOT NULL DEFAULT 'unscheduled';
ALTER TABLE contracts ADD COLUMN schedule_note TEXT;
ALTER TABLE contracts ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contracts_scheduled_at ON contracts(scheduled_at);
