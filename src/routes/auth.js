// src/routes/auth.js - Updated version combining both
import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import sql from "../config/db.js";
import { generateToken } from "../config/auth.js";
import {
  authenticateToken,
  authorizeUser,
  authorizeInstructor,
} from "../middleware/auth.js";
import { isProfileOwner, isPostcodeOwner } from "../middleware/permissions.js";

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

  // Store the redirect URL in session if provided
  if (req.query.redirect) {
    req.session.redirectUrl = req.query.redirect;
  }

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
    // console.log("Session at callback:", req.session);
    // console.log("Selected role from session:", req.session.selectedRole);
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

      // Check if the user exists in our database
      const users = await sql`
        SELECT * FROM users WHERE email = ${req.user.email}
      `;

      // If the user doesn't exist in our database, redirect to login with error
      if (users.length === 0) {
        return res.redirect(
          "/login?error=account_required&message=Please register first before using Google sign-in"
        );
      }

      // User exists, use the database user information
      const existingUser = users[0];

      // Generate token
      const token = generateToken({
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      });

      // Store in session and save
      req.session.token = token;
      req.session.user = {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
      };

      await req.session.save();

      // Use custom redirect URL if provided in session, otherwise use default
      const redirectUrl = req.session.redirectUrl
        ? decodeURIComponent(req.session.redirectUrl)
        : "http://localhost:5000/logged-in"; // Changed to match your frontend CORS origin

      // Clear the stored redirectUrl from session
      delete req.session.redirectUrl;

      // Redirect to frontend with token
      res.redirect(`${redirectUrl}?token=${token}`);
    } catch (error) {
      console.error("Google auth callback error:", error);
      res.redirect("/login?error=oauth_failed");
    }
  }
);

// Example usage in a route file

// Public route - no authentication needed
router.get("/public-data", (req, res) => {
  // Anyone can access
});

// Protected route - any authenticated user can access
router.get("/protected-data", authenticateToken, (req, res) => {
  // Only authenticated users can access
});

// User-specific route - only the specific user can access
router.get(
  "/users/:userId/profile",
  authenticateToken,
  authorizeUser,
  (req, res) => {
    // Only the user with matching ID can access
  }
);

// Instructor-only route - only users with instructor role can access
router.post("/courses", authenticateToken, authorizeInstructor, (req, res) => {
  // Only instructors can create courses
});

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
  // First logout from passport with proper callback
  req.logout(function (err) {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Error during logout" });
    }

    // Then destroy the session
    req.session.destroy(function (err) {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ message: "Error clearing session" });
      }

      // Clear the cookie if needed
      res.clearCookie("connect.sid");

      // Respond with success message
      return res.json({ message: "Logged out successfully" });
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

// PUBLIC ROUTES - Accessible to all users including learners

// Get all instructor profiles - public
router.get("/profiles", async (req, res) => {
  try {
    const profiles = await sql`
      SELECT ip.*, u.name, u.email 
      FROM instructor_profiles ip
      JOIN users u ON ip.user_id = u.id
    `;
    res.json(profiles);
  } catch (error) {
    console.error("Error fetching instructor profiles:", error);
    res.status(500).json({ message: "Error fetching profiles" });
  }
});

// Get specific instructor profile - public
router.get("/profiles/:profileId", async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    const profiles = await sql`
      SELECT ip.*, u.name, u.email 
      FROM instructor_profiles ip
      JOIN users u ON ip.user_id = u.id
      WHERE ip.id = ${profileId}
    `;

    if (profiles.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profiles[0]);
  } catch (error) {
    console.error("Error fetching instructor profile:", error);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Get instructor's postcodes - public
router.get("/profiles/:profileId/postcodes", async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    const postcodes = await sql`
      SELECT * FROM instructor_postcodes
      WHERE profile_id = ${profileId}
    `;
    res.json(postcodes);
  } catch (error) {
    console.error("Error fetching instructor postcodes:", error);
    res.status(500).json({ message: "Error fetching postcodes" });
  }
});

// INSTRUCTOR PROTECTED ROUTES - Only accessible to instructors for their own profiles

// Get current instructor's profile
router.get(
  "/my-profile",
  authenticateToken,
  authorizeInstructor,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const profiles = await sql`
      SELECT * FROM instructor_profiles
      WHERE user_id = ${userId}
    `;

      if (profiles.length === 0) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json(profiles[0]);
    } catch (error) {
      console.error("Error fetching instructor profile:", error);
      res.status(500).json({ message: "Error fetching profile" });
    }
  }
);

// Update instructor's own profile
router.put(
  "/profiles/:profileId",
  authenticateToken,
  authorizeInstructor,
  isProfileOwner,
  async (req, res) => {
    try {
      const { years_experience, hourly_rate, bio } = req.body;
      const profileId = parseInt(req.params.profileId);

      const [updatedProfile] = await sql`
        UPDATE instructor_profiles
        SET 
          years_experience = ${years_experience},
          hourly_rate = ${hourly_rate},
          bio = ${bio},
          updated_at = NOW()
        WHERE id = ${profileId}
        RETURNING *
      `;

      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating instructor profile:", error);
      res.status(500).json({ message: "Error updating profile" });
    }
  }
);

// Add postcode to instructor's profile
router.post(
  "/profiles/:profileId/postcodes",
  authenticateToken,
  authorizeInstructor,
  isProfileOwner,
  async (req, res) => {
    try {
      const { postcode } = req.body;
      const profileId = parseInt(req.params.profileId);

      const [newPostcode] = await sql`
        INSERT INTO instructor_postcodes (
          profile_id, 
          postcode
        ) VALUES (
          ${profileId}, 
          ${postcode}
        )
        RETURNING *
      `;

      res.status(201).json(newPostcode);
    } catch (error) {
      console.error("Error adding instructor postcode:", error);
      res.status(500).json({ message: "Error adding postcode" });
    }
  }
);

// Remove postcode from instructor's profile
router.delete(
  "/postcodes/:postcodeId",
  authenticateToken,
  authorizeInstructor,
  isPostcodeOwner,
  async (req, res) => {
    try {
      const postcodeId = parseInt(req.params.postcodeId);

      await sql`
        DELETE FROM instructor_postcodes
        WHERE id = ${postcodeId}
      `;

      res.json({ message: "Postcode removed successfully" });
    } catch (error) {
      console.error("Error removing instructor postcode:", error);
      res.status(500).json({ message: "Error removing postcode" });
    }
  }
);

export default router;
