// src/routes/auth.js - Updated version combining both
import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import sql from "../config/db.js";
import { generateToken } from "../config/auth.js";

const router = express.Router();

// Registration implementation
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Validate role
    if (!["instructor", "learner"].includes(role)) {
      return res.status(400).json({
        message: "Role must be either instructor or learner",
      });
    }

    // Check if email already exists
    const existingUser = await sql`
            SELECT * FROM users WHERE email = ${email}
        `;

    if (existingUser.length > 0) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const [newUser] = await sql`
            INSERT INTO users (
                name,
                email,
                password,
                auth_type
            ) VALUES (
                ${name},
                ${email},
                ${hashedPassword},
                'local'
            )
            RETURNING *
        `;

    // If user is an instructor, create empty instructor profile
    if (role === "instructor") {
      await sql`
                INSERT INTO instructor_profiles (
                    user_id,
                    years_experience,
                    hourly_rate,
                    bio
                ) VALUES (
                    ${newUser.id},
                    0,
                    0,
                    ''
                )
            `;
    }

    // Generate JWT token
    const token = generateToken(newUser);

    // Send response
    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Error creating user",
    });
  }
});

// Keep your existing routes
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const users = await sql`
            SELECT * FROM users WHERE email = ${email}
        `;

    const user = users[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error during login" });
  }
});


router.get("/google", (req, res, next) => {
  // Store selected role in session from query parameter
  req.session.selectedRole = req.query.role;

  // Save session before redirecting to Google
  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).json({ message: "Error saving session" });
    }
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })(req, res, next);
  });
});

router.get(
  "/google/callback",
  (req, res, next) => {
    // Add debugging for session
    console.log("Session at callback:", req.session);
    console.log("Selected role from session:", req.session.selectedRole);
    next();
  },
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureMessage: true,
    session: true,
  }),
  async (req, res) => {
    try {
      // Ensure we have user data
      if (!req.user) {
        throw new Error("No user data from Google OAuth");
      }

      // Generate token
      const token = generateToken({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      });

      // Store in session and save
      req.session.token = token;
      req.session.user = {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      };

      await req.session.save();

      // Redirect to frontend with token
      res.redirect(`http://localhost:3000/oauth-success?token=${token}`);
    } catch (error) {
      console.error("Google auth callback error:", error);
      res.redirect("/login?error=oauth_failed");
    }
  }
);

// Add role selection route


// Add a route to debug session data
router.get("/debug-session", (req, res) => {
  res.json({
    sessionID: req.sessionID,
    user: req.session.user,
    isAuthenticated: req.isAuthenticated(),
    session: req.session,
  });
});

router.get("/logout", (req, res) => {
  // Clear the session
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ message: "Error during logout" });
    }

    // Logout from passport
    req.logout((err) => {
      if (err) {
        console.error("Passport logout error:", err);
        return res.status(500).json({ message: "Error during logout" });
      }
      res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
    });
  });
});

router.get("/check", (req, res) => {
  if (req.isAuthenticated() && req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user,
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
});

router.get("/test-oauth", (req, res) => {
  // Simulate Google OAuth user data
  req.session.tempUser = {
    id: 999,
    name: "Test User",
    email: "test@example.com",
  };
  res.redirect("/auth/select-role");
});

export default router;
