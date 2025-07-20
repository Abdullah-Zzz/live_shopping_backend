const express = require("express")
const router = express.Router()
const {add_item,remove_item,update_quantity,view_items,clear_cart,get_cart_history} = require("../controllers/cart_controllers") 
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const {auth_limiter} = require("../middleware/auth_limiter")

// Cart routes
router.post("/add",auth,add_item)
router.delete("/remove",auth,remove_item)
router.patch("/update",auth,update_quantity)
router.get("/view",auth,view_items)
router.delete('/clear',auth,clear_cart)
router.get('/history',auth,get_cart_history)

module.exports = router