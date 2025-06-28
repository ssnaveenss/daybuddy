// Import required dependencies
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import "./auth/passport.js"; // Custom Passport configuration

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = 3000;

// Connect to PostgreSQL database
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
db.connect();

// Session configuration for login persistence
app.use(session({
  secret: "daybuddySecret", // Use strong secret in production
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Share logged-in user with all EJS views
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Middleware to protect routes from unauthenticated access
function requireLogin(req, res, next) {
  if (!req.user) return res.redirect("/");
  next();
}

// Google OAuth authentication flow
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/", successRedirect: "/" })
);
app.get("/logout", (req, res) => req.logout(() => res.redirect("/")));

// Motivational quotes to display on dashboard
const quotes = [
  "Start strong, finish stronger!",
  "One step at a time leads to big wins.",
  "Progress over perfection.",
  "Small wins create habits.",
  "Show up for yourself today!"
];

// Update habit streaks if log conditions are satisfied
async function updateStreakIfNeeded(userId, forDate = new Date().toISOString().split("T")[0]) {
  const today = new Date(forDate);

  // Fetch today's log entry
  const logRes = await db.query(
    `SELECT * FROM daily_logs WHERE user_id = $1 AND log_date = $2`,
    [userId, forDate]
  );
  if (!logRes.rows.length) return;

  const log = logRes.rows[0];
  const enoughTasks = log.task_done_count >= 2;
  const didPomo = log.pomodoro_done === true;

  // Check last_checked date to detect missed days
  const lastHabitRes = await db.query(
    `SELECT MIN(last_checked) AS last_checked FROM habits WHERE user_id = $1 AND last_checked IS NOT NULL`,
    [userId]
  );
  const lastChecked = lastHabitRes.rows[0]?.last_checked;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Reset streak if user missed yesterday
  if (lastChecked && lastChecked.toISOString().split("T")[0] < yesterdayStr) {
    await db.query(`UPDATE habits SET streak_count = 0 WHERE user_id = $1`, [userId]);
    console.log(`Reset streaks for user ${userId}`);
  }

  // Increment streak only once per day and only if conditions are met
  if (enoughTasks && didPomo && !log.streak_incremented) {
    const updRes = await db.query(
      `UPDATE habits
       SET streak_count = streak_count + 1, last_checked = $1
       WHERE user_id = $2 AND (last_checked IS NULL OR last_checked < $1)`,
      [forDate, userId]
    );
    console.log(`Incremented streaks for ${updRes.rowCount} habit(s) of user ${userId}`);

    // Record the new streak in history
    const maxStreakRes = await db.query(
      `SELECT MAX(streak_count) AS streak FROM habits WHERE user_id = $1`,
      [userId]
    );
    const newStreak = maxStreakRes.rows[0].streak || 0;

    await db.query(
      `INSERT INTO streak_history (user_id, date, streak_on_day)
       VALUES ($1, $2, $3)`,
      [userId, forDate, newStreak]
    );

    // Mark today's streak as updated
    await db.query(
      `UPDATE daily_logs SET streak_incremented = TRUE WHERE user_id = $1 AND log_date = $2`,
      [userId, forDate]
    );
  } else {
    console.warn(`Streak not updated for user ${userId}`);
  }
}

// Home route – dashboard or login prompt
app.get("/", async (req, res) => {
  const userId = req.user?.id;
  let habits = [], showWarning = false;
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  if (userId) {
    await updateStreakIfNeeded(userId);

    // Get user's habits
    const habRes = await db.query("SELECT * FROM habits WHERE user_id = $1 ORDER BY id DESC", [userId]);
    habits = habRes.rows;

    // Determine whether to show warning
    const today = new Date().toISOString().split("T")[0];
    const logRes = await db.query("SELECT * FROM daily_logs WHERE user_id = $1 AND log_date = $2", [userId, today]);
    if (logRes.rows.length) {
      const l = logRes.rows[0];
      showWarning = !(l.task_done_count >= 2 && l.pomodoro_done);
    } else {
      showWarning = true;
    }
  }

  res.render("index.ejs", { habits, showWarning, quote });
});

// Redirect dashboard to home
app.get("/dashboard", requireLogin, (req, res) => res.redirect("/"));

// Render tasks page with todos and goals
app.get("/tasks", requireLogin, async (req, res) => {
  const todos = (await db.query("SELECT * FROM todos WHERE user_id = $1 ORDER BY id DESC", [req.user.id])).rows;
  const goals = (await db.query("SELECT * FROM goals WHERE user_id = $1 ORDER BY id DESC", [req.user.id])).rows;
  res.render("tasks.ejs", { todos, goals });
});

// Todos CRUD operations
app.post("/add-todo", requireLogin, async (req, res) => {
  await db.query("INSERT INTO todos (task, user_id) VALUES ($1, $2)", [req.body.todo, req.user.id]);
  res.redirect("/tasks");
});
app.post("/edit-todo", requireLogin, async (req, res) => {
  await db.query("UPDATE todos SET task = $1 WHERE id = $2 AND user_id = $3", [req.body.updatedText, req.body.todoId, req.user.id]);
  res.redirect("/tasks");
});
app.post("/delete-todo", requireLogin, async (req, res) => {
  await db.query("DELETE FROM todos WHERE id = $1 AND user_id = $2", [req.body.todoId, req.user.id]);
  res.redirect("/tasks");
});
app.post("/done-todo", requireLogin, async (req, res) => {
  const id = req.body.todoId;
  try {
    await db.query(
      "UPDATE todos SET is_done = TRUE WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    await db.query(
      `INSERT INTO daily_logs (log_date, task_done_count, user_id)
       VALUES (CURRENT_DATE, 1, $1)
       ON CONFLICT (log_date, user_id) DO UPDATE
       SET task_done_count = daily_logs.task_done_count + 1;`,
      [req.user.id]
    );
    await updateStreakIfNeeded(req.user.id);
  } catch (err) {
    console.error("Error marking todo done:", err);
  }
  res.redirect("/tasks");
});


// Goals CRUD operations
app.post("/add-goal", requireLogin, async (req, res) => {
  await db.query("INSERT INTO goals (goal_text, user_id) VALUES ($1, $2)", [req.body.goal, req.user.id]);
  res.redirect("/tasks");
});
app.post("/done-goal", requireLogin, async (req, res) => {
  await db.query("UPDATE goals SET is_completed = TRUE WHERE id = $1 AND user_id = $2", [req.body.goalId, req.user.id]);
  res.redirect("/tasks");
});
app.post("/delete-goal", requireLogin, async (req, res) => {
  await db.query("DELETE FROM goals WHERE id = $1 AND user_id = $2", [req.body.goalId, req.user.id]);
  res.redirect("/tasks");
});
app.post("/edit-goal", requireLogin, async (req, res) => {
  const { goalId, updatedText } = req.body;

  if (!updatedText || updatedText.trim() === "") {
    return res.status(400).send("Goal text is required.");
  }

  try {
    await db.query(
      "UPDATE goals SET goal_text = $1 WHERE id = $2 AND user_id = $3",
      [updatedText.trim(), goalId, req.user.id]
    );
    res.redirect("/tasks");
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).send("Error updating goal.");
  }
});

// Habit tracking
app.post("/add-habit", requireLogin, async (req, res) => {
  await db.query("INSERT INTO habits (habit_name, user_id) VALUES ($1, $2)", [req.body.habit, req.user.id]);
  res.redirect("/tasks");
});
app.post("/complete-habit", requireLogin, async (req, res) => {
  await db.query("UPDATE habits SET last_checked = CURRENT_DATE WHERE id = $1 AND user_id = $2", [req.body.habitId, req.user.id]);
  res.redirect("/tasks");
});

// Log Pomodoro completion
app.post("/log-pomodoro", requireLogin, async (req, res) => {
  await db.query(
    `INSERT INTO daily_logs (log_date, pomodoro_done, user_id)
     VALUES (CURRENT_DATE, TRUE, $1)
     ON CONFLICT (log_date, user_id) DO UPDATE
     SET pomodoro_done = TRUE;`,
    [req.user.id]
  );
  await updateStreakIfNeeded(req.user.id);
  res.sendStatus(200);
});

// Pomodoro timer interface
app.get("/pomodoro", requireLogin, (req, res) => {
  res.render("pomodoro.ejs");
});

// Daily midnight auto-check to update streaks if missed
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 5) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const users = await db.query(
      `SELECT DISTINCT user_id FROM daily_logs WHERE log_date = $1 AND streak_incremented = FALSE`,
      [yesterday]
    );
    for (const r of users.rows) {
      await updateStreakIfNeeded(r.user_id, yesterday);
    }
  }
}, 60000);

// My Resources section
app.get("/resources", requireLogin, async (req, res) => {
  const resources = (await db.query(
    "SELECT * FROM resources WHERE user_id = $1 ORDER BY id DESC",
    [req.user.id]
  )).rows;
  res.render("resources.ejs", { resources });
});
app.post("/add-resource", requireLogin, async (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.redirect("/resources");
  await db.query(
    "INSERT INTO resources (name, url, user_id) VALUES ($1, $2, $3)",
    [name, url, req.user.id]
  );
  res.redirect("/resources");
});
app.post("/delete-resource", requireLogin, async (req, res) => {
  await db.query(
    "DELETE FROM resources WHERE id = $1 AND user_id = $2",
    [req.body.resourceId, req.user.id]
  );
  res.redirect("/resources");
});

// Progress page – shows 30-day habit completion history
app.get("/progress", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/");

  const userId = req.user.id;

  // Get recent 30-day logs
  const result = await db.query(
    `SELECT log_date, task_done_count, pomodoro_done
     FROM daily_logs
     WHERE user_id = $1
     AND log_date >= CURRENT_DATE - INTERVAL '29 days'`,
    [userId]
  );

  const logs = {};
  result.rows.forEach(row => {
    const date = row.log_date.toISOString().slice(0, 10);
    const metHabit = row.task_done_count >= 2 && row.pomodoro_done;
    logs[date] = metHabit;
  });

  // Prepare calendar data
  const calendar = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const formatted = date.toISOString().slice(0, 10);

    calendar.push({
      date: formatted.slice(5),
      met: logs[formatted] === true
    });
  }

  res.render("progress", { calendar });
});

// About me : Naveen S S
app.get("/about", (req, res) => {
  res.render("about");
});


// Start the server
app.listen(port, () => console.log(`DayBuddy running at http://localhost:${port}`));
