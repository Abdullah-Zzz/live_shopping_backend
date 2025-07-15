// routes/user_routes.js
const express = require("express");
const router = express.Router();
const {
  registerUser,
  verifyUser,
  loginUser,
  userDashboard,
  logout,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  completeProfile,
  editBuyerProfile,
  editSellerProfile,
  changePhone
} = require("../controllers/user_controllers");
const { auth, isAdmin, isBuyer, isSeller } = require("../middleware/auth");
const authLimiter = require("../middleware/auth_limiter"); // Import directly

// Authentication routes
router.post("/register", authLimiter, registerUser);
router.get("/verify/:token", verifyUser);
router.post("/login", authLimiter, loginUser);
router.post("/logout", auth, logout);
router.post("/refresh-token", refreshAccessToken);

// Password recovery routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Profile routes
router.get("/dashboard", auth, userDashboard);
router.post("/complete-profile", auth, completeProfile);
router.put("/profile/buyer", auth, isBuyer, editBuyerProfile);
router.put("/profile/seller", auth, isSeller, editSellerProfile);
router.put("/change-phone", auth, changePhone);

module.exports = router;