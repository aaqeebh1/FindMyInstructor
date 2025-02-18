// src/config/passport.js
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import sql from "./db.js";

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const users = await sql`
          SELECT * FROM users WHERE email = ${email}
        `;

        const user = users[0];

        if (!user) {
          return done(null, false, { message: "Incorrect email." });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google Strategy setup
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        let users = await sql`
          SELECT u.* FROM users u
          JOIN oauth_connections o ON u.id = o.user_id
          WHERE o.provider = 'google' AND o.provider_user_id = ${profile.id}
        `;

        let user = users[0];

        if (!user) {
          // Create new user if doesn't exist
          const newUsers = await sql`
            INSERT INTO users (
              name, 
              email, 
              password,
              role
            ) VALUES (
              ${profile.displayName},
              ${profile.emails[0].value},
              ${await bcrypt.hash(Math.random().toString(36), 10)},
              'learner'
            )
            RETURNING *
          `;

          user = newUsers[0];

          // Create OAuth connection
          await sql`
            INSERT INTO oauth_connections (
              user_id,
              provider,
              provider_user_id,
              access_token,
              refresh_token
            ) VALUES (
              ${user.id},
              'google',
              ${profile.id},
              ${accessToken},
              ${refreshToken}
            )
          `;
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const users = await sql`
      SELECT * FROM users WHERE id = ${id}
    `;
    done(null, users[0]);
  } catch (error) {
    done(error);
  }
});

export default passport;
