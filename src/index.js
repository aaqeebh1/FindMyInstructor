import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import pg from "pg";
import cors from "cors";

// Import your PostgreSQL connection

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize PostgreSQL connection
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const setUserContext = async (client, userId) => {
  await client.query("SET app.user_id = $1", [userId || null]);
};

// Create PgSession store correctly
const PgSessionStore = pgSession(session);

// Configure session middleware
app.use(
  session({
    store: new PgSessionStore({
      pool: pool,
      tableName: "session"  // Make sure this table exists
    }),
    secret: process.env.SESSION_SECRET || "your-secure-session-secret",
    resave: false,
    saveUninitialized: true,  // Set to true for OAuth flows
    cookie: { 
      maxAge: 30 * 24 * 60 * 60 * 1000,
    }
  })
);

// Initialize passport AFTER session
app.use(passport.initialize());
app.use(passport.session());

// Configure CORS
app.use(
  cors({
    origin: "http://localhost:5000",
    credentials: true,
  })
);

// Routes
app.use("/auth", authRoutes);

// Test route for session
app.get("/test-session", (req, res) => {
  req.session.testData = Date.now();
  res.json({
    message: "Session test",
    sessionID: req.sessionID,
    testData: req.session.testData,
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
