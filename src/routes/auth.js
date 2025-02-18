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
    const newUser = await sql`
            INSERT INTO users (
                name,
                email,
                password,
                role
            ) VALUES (
                ${name},
                ${email},
                ${hashedPassword},
                ${role}
            )
            RETURNING id, name, email, role
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
                    ${newUser[0].id},
                    0,
                    0,
                    ''
                )
            `;
    }

    // Generate JWT token
    const token = generateToken(newUser[0]);

    // Send response
    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser[0].id,
        name: newUser[0].name,
        email: newUser[0].email,
        role: newUser[0].role,
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

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  (req, res) => {
    // OAuth callback implementation will go here
  }
);

router.get("/logout", (req, res) => {
  // Logout implementation will go here
});

export default router; 
