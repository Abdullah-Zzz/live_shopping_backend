const {getStore, followStore, unfollowStore,updateStore} = require("../controllers/store_controllers")
const express = require("express")
const router = express.Router()
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const {auth_limiter} = require("../middleware/auth_limiter")

// Get current seller's store
router.get("/",auth,isSeller,getStore)
// Follow a store
router.post("/follow", auth, isBuyer, followStore)
// Unfollow a store
router.post("/unfollow", auth, isBuyer, unfollowStore)

router.post("/update",auth,isSeller,updateStore)

module.exports = router