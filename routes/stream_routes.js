const express = require("express")
const router = express.Router()
const {generate_zego_token,initiate_live,start_live,end_live,active_live} = require("../controllers/stream_controllers")
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const {auth_limiter} = require("../middleware/auth_limiter")

router.get("/:roomId/token" ,auth,isSeller,generate_zego_token)
router.post("/initiate",auth,isSeller,initiate_live)
router.post("/:id/start",auth,isSeller,start_live)
router.put("/:id/end",auth,isSeller,end_live)
router.get("/active",auth,isSeller,active_live)

module.exports = router