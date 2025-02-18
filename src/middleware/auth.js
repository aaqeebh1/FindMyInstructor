// src/middleware/auth.js
import { verifyToken } from "../config/auth.js";

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const user = verifyToken(token);
      req.user = user;
      next();
    } catch (error) {
      res.status(403).json({ message: "Invalid token" });
    }
  } else {
    res.status(401).json({ message: "Authorization header required" });
  }
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ message: "Insufficient permissions" });
    }
  };
};
