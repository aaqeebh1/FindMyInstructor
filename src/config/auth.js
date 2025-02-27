// src/config/auth.js
import jwt from "jsonwebtoken";

// Use environment variable or fallback to a default (only for development)
export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here";

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid token");
  }
};
