const express = require("express");
const router = express.Router();
const {
  placeOrder,
  viewOrders,
  deleteOrder,
  editOrder,
  changeOrderStatus,
  getOrderDetails
} = require("../controllers/order_controllers");
const { auth, isSeller, isAdmin, isBuyer } = require("../middleware/auth");
const { authLimiter } = require("../middleware/auth_limiter");

// Buyer order routes
router.post("/", auth,  placeOrder);
router.get("/", auth, isBuyer, viewOrders);
router.delete("/:id", auth, isBuyer, deleteOrder);
router.put("/:id", auth, isBuyer, editOrder);

// Seller order routes
router.put("/:id/status", auth, isSeller, changeOrderStatus);
router.get("/get/:id",auth,isSeller,getOrderDetails)

module.exports = router;