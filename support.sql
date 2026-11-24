CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  order_reference TEXT NOT NULL,
  message TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS support_requests_pending ON support_requests(resolved_at, created_at);
