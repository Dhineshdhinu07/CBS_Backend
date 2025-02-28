 -- Add timestamp columns to users table
ALTER TABLE users ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch());
ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch());