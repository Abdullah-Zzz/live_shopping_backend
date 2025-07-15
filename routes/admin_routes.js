const express = require("express");
const router = express.Router();
const {
  getSellers,
  verifySeller,
  manageSellerStatus,
  getStores,
  verifyStore,
  manageStoreStatus,
  getStoreDetails,
  getAdminDashboardStats,
  getAllOrders,
  adminCancelOrder
} = require("../controllers/admin_controllers");
const { auth, isAdmin } = require("../middleware/auth");

// Seller management routes
router.get("/sellers", auth, isAdmin, getSellers);
router.post("/sellers/verify", auth, verifySeller);
router.put("/sellers/status", auth, isAdmin, manageSellerStatus);

// Store management routes
router.get("/stores", auth, isAdmin, getStores);
router.get("/stores/:id", auth, isAdmin, getStoreDetails);
router.post("/stores/verify", auth, isAdmin, verifyStore);
router.put("/stores/status", auth, isAdmin, manageStoreStatus);

// Order management routes
router.get("/orders", auth, isAdmin, getAllOrders);
router.put("/orders/:id/cancel", auth, isAdmin, adminCancelOrder);

// Dashboard route
router.get("/dashboard", auth, isAdmin, getAdminDashboardStats);

module.exports = router;