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
      passReqToCallback: true,
    },
    async function (req, accessToken, refreshToken, profile, done) {
      try {
        // First check for existing user
        const users = await sql`
    SELECT u.* FROM users u
    LEFT JOIN oauth_connections o ON u.id = o.user_id
    WHERE o.provider = 'google' 
    AND o.provider_user_id = ${profile.id}
  `;

        if (users.length > 0) {
          console.log("Found existing user:", users[0].id);
          return done(null, users[0]);
        }

        const role = req.session.selectedRole;
        console.log("Selected role:", role);

        if (!role) {
          return done(null, false, { message: "Role not selected" });
        }

        const emailValue =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;

        const photoValue =
          profile.photos && profile.photos.length > 0
            ? profile.photos[0].value
            : null;

        // Then use these variables in your query
        const [newUser] = await sql`
  INSERT INTO users (
    name, 
    email, 
    avatar_url, 
    auth_type, 
    role
  ) VALUES (
    ${profile.displayName || "User"},
    ${emailValue},
    ${photoValue},
    'oauth',
    ${role}
  )
  RETURNING *
`;
        console.log("Created new user:", newUser.id);

        // Insert OAuth connection
       const userID = newUser.id;
       const googleID = profile.id;
       const accessTokenValue = accessToken || null; // Use null instead of empty string
       const refreshTokenValue = refreshToken || null; // Use null instead of empty string

       // Then use these variables in your query
       const [oauthConnection] = await sql`
  INSERT INTO oauth_connections (
    user_id,
    provider,
    provider_user_id,
    access_token,
    refresh_token
  ) VALUES (
    ${userID},
    'google',
    ${googleID},
    ${accessTokenValue},
    ${refreshTokenValue}
  )
  RETURNING *
`;
        console.log("Created OAuth connection");

        // Create instructor record if needed
        if (role === "instructor") {
          await sql`
    INSERT INTO instructor_profiles (user_id)
    VALUES (${newUser.id})
  `;
          console.log("Created instructor record");
        }
        console.log("Debugging values before insert:");
        console.log("User ID:", newUser.id);
        console.log("Google ID:", profile.id);
        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);

        return done(null, newUser);
      } catch (error) {
        console.error("Error in Google Strategy:", error);
        return done(null, false, { message: error.message });
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
    const [user] = await sql`
      SELECT id, name, email, role 
      FROM users 
      WHERE id = ${id}
    `;
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
