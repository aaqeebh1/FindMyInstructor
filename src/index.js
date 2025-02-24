import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";

// Import your PostgreSQL connection

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Initialize PostgreSQL connection
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL});

try {
  const PgSession = pgSession(session);

  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "session",
      }),
      secret: process.env.SESSION_SECRET || "your-secure-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === "production",
      },
    })
  );
} catch (err) {
  console.error("Session store error:", err);
}

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", authRoutes);
// Your other routes...

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
