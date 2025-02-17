import sql from "./config/db.js";

async function testDB() {
  try {
    const result = await sql`SELECT current_timestamp;`;
    console.log("Database connection successful!");
    console.log("Current time from DB:", result[0].current_timestamp);
  } catch (error) {
    console.error("Error connecting to database:", error);
  } finally {
    await sql.end(); // Close the connection
  }
}

testDB();
