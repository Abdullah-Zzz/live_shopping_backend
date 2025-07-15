const express = require("express");
const router = express.Router();
const {
  retrieveProducts,
  getSellerProducts,
  getProductById,
  getCurrentSellerProducts,
  addProduct,
  editProduct,
  deleteProduct
} = require("../controllers/product_controllers");
const { auth, isSeller, isAdmin, isBuyer } = require("../middleware/auth");

// Public product routes
router.get("/", retrieveProducts);
router.get("/:id", getProductById);
router.get("/seller/:sellerId", getSellerProducts);

// Seller product routes
router.get("/seller/my-products", auth, isSeller, getCurrentSellerProducts);
router.post("/", auth, isSeller, addProduct);
router.put("/:id", auth, isSeller, editProduct);
router.delete("/:id", auth, isSeller, deleteProduct);

// Admin product routes (for moderation)
router.delete("/admin/:id", auth, isAdmin, deleteProduct);

module.exports = router;