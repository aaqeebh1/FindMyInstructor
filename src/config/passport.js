import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import sql from "./db.js";

// Improved helper function to ensure no undefined values
const safeValue = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  return value;
};

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
        
        // Make sure we have safe values for tokens
        const safeAccessToken = safeValue(accessToken);
        const safeRefreshToken = safeValue(refreshToken);


        // Check if user exists by OAuth connection
        let users = await sql`
          SELECT u.* FROM users u
          JOIN oauth_connections o ON u.id = o.user_id
          WHERE o.provider = 'google' AND o.provider_user_id = ${profile.id}
        `;

        let user = users[0];

        if (!user) {
          // Check if user exists by email
          const email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : null;

          if (!email) {
            return done(new Error("No email provided from Google OAuth"), null);
          }

          users = await sql`
            SELECT * FROM users WHERE email = ${email}
          `;

          user = users[0];

          if (!user) {
            // Create new user if doesn't exist
            const displayName = profile.displayName || "Google User";
            const randomPassword = await bcrypt.hash(
              Math.random().toString(36),
              10
            );

            const newUsers = await sql`
              INSERT INTO users (
                name, 
                email, 
                password,
                role
              ) VALUES (
                ${displayName},
                ${email},
                ${randomPassword},
                'learner'
              )
              RETURNING *
            `;

            user = newUsers[0];
          }

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
              ${safeAccessToken},
              ${safeRefreshToken}
            )
          `;
        } else {
          // Update OAuth connection with new tokens
          await sql`
            UPDATE oauth_connections
            SET 
              access_token = ${safeAccessToken}, 
              refresh_token = ${safeRefreshToken}
            WHERE user_id = ${user.id} AND provider = 'google'
          `;
        }


        return done(null, user);
      } catch (error) {
        console.error("Error in Google strategy:", error);
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
