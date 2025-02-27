// src/config/db.js
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, {
  ssl: "require",
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Idle connection timeout in seconds
});

// Test the connection
// async function testConnection() {
//   try {
//     const result = await sql`SELECT NOW()`;
//     console.log("Database connected successfully!");
//   } catch (error) {
//     console.error("Database connection error:", error);
//   }
// }

// testConnection();

export default sql;
