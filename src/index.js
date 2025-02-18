// src/index.js
import express from "express";
import bodyParser from "body-parser";
import passport from "passport";
import authRoutes from "./routes/auth.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(passport.initialize());
app.use("/auth", authRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});