-- 1. Users
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT,
  password      TEXT,
  google_id     TEXT UNIQUE,
  email         TEXT UNIQUE
);

-- 2. Todos (daily tasks)
CREATE TABLE todos (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task         TEXT NOT NULL,
  created_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  is_done      BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. Goals (long‑term)
CREATE TABLE goals (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_text     TEXT NOT NULL,
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE
);

-- 4. Habits
CREATE TABLE habits (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_name     TEXT NOT NULL,
  streak_count   INTEGER NOT NULL DEFAULT 0,
  last_checked   DATE,
  last_streak_date DATE  -- optional
);

-- 5. Daily Logs (for each user & day)
--    one row per (user_id, log_date), to count tasks + pomodoro + streak increment flag
CREATE TABLE daily_logs (
  log_date           DATE    NOT NULL,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_done_count    INTEGER NOT NULL DEFAULT 0,
  pomodoro_done      BOOLEAN NOT NULL DEFAULT FALSE,
  streak_incremented BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, log_date)
);

-- 6. Streak History (snapshot of streak_count at end of each day)
CREATE TABLE streak_history (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  streak_on_day INTEGER NOT NULL,
  UNIQUE (user_id, date)
);

-- 7. Resources (user‑saved links)
CREATE TABLE resources (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT    NOT NULL,
  url     TEXT    NOT NULL
);
