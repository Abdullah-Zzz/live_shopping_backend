const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const auth = (req, res, next) => {
  const access_token = req.cookies.access_token;
  const refresh_token = req.cookies.refresh_token;

  if (!access_token && !refresh_token) {
    return res.status(401).json({ message: "Unauthorized: No tokens provided" });
  }

  try {
    const decoded = jwt.verify(access_token, JWT_ACCESS_SECRET);
    req.user = decoded;
    return next();
  } catch (accessErr) {
    if (!refresh_token) {
      return res.status(401).json({ message: "Access token expired. No refresh token." });
    }

    try {
      const decodedRefresh = jwt.verify(refresh_token, JWT_REFRESH_SECRET);

      // Create a new access token
      const newAccessToken = jwt.sign(
        {
          id: decodedRefresh.id,
          role: decodedRefresh.role,
        },
        JWT_ACCESS_SECRET,
        { expiresIn: "15m" }
      );

      // Set new access token as cookie
      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      req.user = decodedRefresh; // attach to request
      return next();
    } catch (refreshErr) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  }
};

const isSeller = (req, res, next) => {
  if (req.user.role !== "seller")
    return res.status(403).json({ message: "Only sellers allowed" });
  next();
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Only admins allowed" });
  next();
};

const isBuyer = (req, res, next) => {
  if (req.user.role !== "buyer")
    return res.status(403).json({ message: "Only buyers allowed" });
  next();
};

module.exports = {
  auth,
  isSeller,
  isAdmin,
  isBuyer,
};
