import sql from "../config/db.js";

// Check if user is the owner of a specific instructor profile
export const isProfileOwner = async (req, res, next) => {
  try {
    const profileId = parseInt(req.params.profileId || req.body.profile_id);
    const userId = req.user.id;

    // Get profile from database
    const profiles = await sql`
      SELECT * FROM instructor_profiles 
      WHERE id = ${profileId} AND user_id = ${userId}
    `;

    if (profiles.length === 0) {
      return res
        .status(403)
        .json({ message: "You don't have permission to manage this profile" });
    }

    // Attach profile to request for later use
    req.instructorProfile = profiles[0];
    next();
  } catch (error) {
    console.error("Profile ownership check error:", error);
    res.status(500).json({ message: "Error checking profile ownership" });
  }
};

// Check if user is the owner of a postcode
export const isPostcodeOwner = async (req, res, next) => {
  // Implementation as shown previously
};
