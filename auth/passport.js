import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

// Setup PostgreSQL client
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
db.connect();

// Google OAuth2 Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      const googleId = profile.id;
      const name = profile.displayName;
      const email = profile.emails[0].value;

      try {
        // Check if user exists
        const result = await db.query("SELECT * FROM users WHERE google_id = $1", [googleId]);

        if (result.rows.length > 0) {
          // Existing user
          return done(null, result.rows[0]);
        } else {
          // New user: insert into users table
          const newUser = await db.query(
            "INSERT INTO users (google_id, username, email) VALUES ($1, $2, $3) RETURNING *",
            [googleId, name, email]
          );

          // Insert default habit for the new user
          await db.query(
            "INSERT INTO habits (habit_name, user_id, streak_count) VALUES ($1, $2, 0)",
            ['Daily Focus', newUser.rows[0].id]
          );

          return done(null, newUser.rows[0]);
        }
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Serialize user into session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user and attach displayName for EJS
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    const user = result.rows[0];

    done(null, {
      id: user.id,
      displayName: user.username, // accessible in EJS as user.displayName
      email: user.email,
    });
  } catch (err) {
    done(err, null);
  }
});
