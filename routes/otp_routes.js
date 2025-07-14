const express = require("express")
const router = express.Router()
const {send_otp,verify_otp,resend_otp} = require("../controllers/otp_controllers")

router.post("/send-otp",send_otp)
router.post("/verify-otp",verify_otp)
router.post("/resend-otp",resend_otp)


module.exports = router