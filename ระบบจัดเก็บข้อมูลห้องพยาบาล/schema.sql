-- ============================================================================
-- ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี จ.สมุทรปราการ
-- Cloudflare D1 Database Schema (SQLite)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nurse_records (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  datetime TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'student',
  full_name TEXT NOT NULL,
  gender TEXT DEFAULT 'ไม่ระบุ',
  grade TEXT DEFAULT '',
  room TEXT DEFAULT '',
  student_no TEXT DEFAULT '',
  position TEXT DEFAULT '',
  symptoms TEXT NOT NULL,
  treatment TEXT DEFAULT 'ให้คำแนะนำและสังเกตอาการ',
  medication TEXT DEFAULT 'ไม่ได้จ่ายยา',
  record_by TEXT NOT NULL,
  notes TEXT DEFAULT '',
  temperature TEXT DEFAULT '',
  vital_bp TEXT DEFAULT '',
  vital_hr TEXT DEFAULT '',
  vital_spo2 TEXT DEFAULT '',
  vital_rr TEXT DEFAULT '',
  vital_dtx TEXT DEFAULT '',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance sorting and statistics
CREATE INDEX IF NOT EXISTS idx_records_datetime ON nurse_records(datetime DESC);
CREATE INDEX IF NOT EXISTS idx_records_user_type ON nurse_records(user_type);
CREATE INDEX IF NOT EXISTS idx_records_grade ON nurse_records(grade);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON nurse_records(created_at DESC);
