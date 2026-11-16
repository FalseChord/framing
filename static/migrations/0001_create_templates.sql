-- Online source of truth for letter templates while the static build is the
-- deployed app (see docs/STATIC_DEPLOY.md). Mirrors prisma Template, except the
-- editor is stored by operator name (no users table here).
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '不適用',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  required_fields TEXT NOT NULL DEFAULT '[]',
  optional_fields TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE (category, variant_label)
);
