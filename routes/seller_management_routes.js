const { 
  getSellerOrders,
  updateOrderStatus,
  bulkUpdateOrders,
  getOrderAnalytics,
} = require('../controllers/seller_management');
const {auth,isSeller,isAdmin} = require("../middleware/auth")
const express = require("express")
const router = express.Router()

router.get('/seller/orders',auth, isSeller, getSellerOrders);
router.patch('/seller/orders/:id/status',auth, isSeller, updateOrderStatus);
router.post('/seller/orders/bulk-update',auth, isSeller, bulkUpdateOrders);
router.get('/seller/analytics',auth, isSeller, getOrderAnalytics);


module.exports = router