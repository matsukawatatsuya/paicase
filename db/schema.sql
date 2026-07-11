-- フィジカルAI事例トラッカー DBスキーマ

CREATE TABLE IF NOT EXISTS industries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS use_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_date TEXT,
  source_name TEXT,
  official_score INTEGER NOT NULL DEFAULT 1,
  company TEXT,
  summary TEXT,
  image_url TEXT,
  dedupe_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS case_industries (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  industry_id INTEGER NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  PRIMARY KEY (case_id, industry_id)
);

CREATE TABLE IF NOT EXISTS case_usecases (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  usecase_id INTEGER NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE,
  PRIMARY KEY (case_id, usecase_id)
);

CREATE TABLE IF NOT EXISTS case_vendors (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  PRIMARY KEY (case_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_case_industries_case ON case_industries(case_id);
CREATE INDEX IF NOT EXISTS idx_case_industries_industry ON case_industries(industry_id);
CREATE INDEX IF NOT EXISTS idx_case_usecases_case ON case_usecases(case_id);
CREATE INDEX IF NOT EXISTS idx_case_usecases_usecase ON case_usecases(usecase_id);
CREATE INDEX IF NOT EXISTS idx_case_vendors_case ON case_vendors(case_id);
CREATE INDEX IF NOT EXISTS idx_case_vendors_vendor ON case_vendors(vendor_id);
