// src/db/init.js
import sql from "../config/db.js";

async function createTables() {
  try {
    // Users table
    await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) CHECK (role IN ('instructor', 'learner')) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
    console.log("Users table created successfully");

    // Instructor profiles
    await sql`
            CREATE TABLE IF NOT EXISTS instructor_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
                years_experience INTEGER,
                hourly_rate DECIMAL(10,2),
                bio TEXT,
                profile_photo_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
    console.log("Instructor profiles table created successfully");

    // Instructor postcodes coverage
    await sql`
            CREATE TABLE IF NOT EXISTS instructor_postcodes (
                id SERIAL PRIMARY KEY,
                instructor_id INTEGER REFERENCES instructor_profiles(id),
                postcode VARCHAR(10) NOT NULL,
                UNIQUE(instructor_id, postcode)
            )
        `;
    console.log("Instructor postcodes table created successfully");

    // OAuth connections
    await sql`
            CREATE TABLE IF NOT EXISTS oauth_connections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                provider VARCHAR(50) NOT NULL,
                provider_user_id VARCHAR(255) NOT NULL,
                access_token TEXT,
                refresh_token TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, provider_user_id)
            )
        `;
    console.log("OAuth connections table created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the initialization
createTables()
  .then(() => console.log("All tables created successfully"))
  .catch((error) => {
    console.error("Failed to create tables:", error);
    process.exit(1);
  });
