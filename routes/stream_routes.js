const express = require("express")
const router = express.Router()
const {generate_zego_token,initiate_live,start_live,end_live,active_live,getStoreLiveSessions,getSellerLiveSessions} = require("../controllers/stream_controllers")
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const {auth_limiter} = require("../middleware/auth_limiter")

// Zego token for a room
router.get("/:roomId/token" ,auth,isSeller,generate_zego_token)
// Initiate a live session
router.post("/initiate",auth,isSeller,initiate_live)
// Start a live session
router.post("/:id/start",auth,isSeller,start_live)
// End a live session
router.put("/:id/end",auth,isSeller,end_live)
// Get active live sessions (with filters)
router.get("/active",auth,isSeller,active_live)
// Get all live sessions for a store
router.get("/store/:storeId", auth, getStoreLiveSessions)
// Get all live sessions for a seller
router.get("/seller/:sellerId", auth, getSellerLiveSessions)

module.exports = router