// src/middleware/auth.js
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/auth.js";

// Authentication middleware that verifies JWT tokens
export const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Store user info from token
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Authorization middleware for user-specific resources
export const authorizeUser = (req, res, next) => {
  // Check if authenticated user matches requested user ID
  if (
    req.user &&
    (req.user.id === parseInt(req.params.userId) ||
      req.user.id === parseInt(req.body.user_id))
  ) {
    next();
  } else {
    return res
      .status(403)
      .json({
        message: "Access denied: Not authorized to access this resource",
      });
  }
};

// Instructor role authorization middleware
export const authorizeInstructor = (req, res, next) => {
  // Check if user has instructor role
  if (req.user && req.user.role === "instructor") {
    next();
  } else {
    return res
      .status(403)
      .json({ message: "Access denied: Instructor permission required" });
  }
};
