const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const user_schema = require("../models/user_schema")
const jwt = require("jsonwebtoken")

const googleLogin = async (req, res) => {
  try {
    const { idToken,phone } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    let user = await user_schema.findOne({ email });

    if (!user) {
      user = await user_schema.create({
        name: payload.name,
        email,
        password:"googleOauth",
        isProfileComplete: false,
        role: "buyer", 
      });
    }

    const accessToken = jwt.sign({ id: user._id, email: user.email, role:user.role, }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user._id, email: user.email, role:user.role }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    res.cookie("access_token", accessToken, { httpOnly: true, sameSite: "strict", secure: true });
    res.cookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "strict", secure: true });

    return res.status(200).json({ message: "Logged in with Google", user });

  } catch (err) {
    console.error("Google OAuth Error:", err);
    return res.status(401).json({ message: "Invalid Google ID token" });
  }
};

module.exports = googleLogin