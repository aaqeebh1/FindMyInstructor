-- Users table (base table for both instructors and learners)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('instructor', 'learner')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Instructor profiles (extends user table for instructor-specific info)
CREATE TABLE instructor_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    years_experience INTEGER,
    hourly_rate DECIMAL(10,2),
    bio TEXT,
    profile_photo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Instructor postcodes coverage
CREATE TABLE instructor_postcodes (
    id SERIAL PRIMARY KEY,
    instructor_id INTEGER REFERENCES instructor_profiles(id),
    postcode VARCHAR(10) NOT NULL,
    UNIQUE(instructor_id, postcode)
);

-- OAuth connections (for supporting OAuth login)
CREATE TABLE oauth_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    provider VARCHAR(50) NOT NULL, -- 'google', 'apple', etc.
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id)
);