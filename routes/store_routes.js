const {getStore} = require("../controllers/store_controllers")
const express = require("express")
const router = express.Router()
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const {auth_limiter} = require("../middleware/auth_limiter")


router.get("/",auth,isSeller,getStore)

module.exports = router