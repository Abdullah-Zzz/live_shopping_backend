const express = require("express")
const router = express.Router()
const {place_order,view_order,delete_order,edit_order,change_order_status} = require("../controllers/order_controllers") 
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const {auth_limiter} = require("../middleware/auth_limiter")

router.post("/place",auth,place_order)
router.get("/view",auth,view_order)
router.delete("/delete/:id",auth,delete_order)
router.put("/edit",auth,edit_order)
router.put("/change-status/:id",auth,change_order_status)

module.exports = router