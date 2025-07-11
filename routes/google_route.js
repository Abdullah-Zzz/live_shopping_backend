const express = require("express")
const router = express.Router()
const jwt = require("jsonwebtoken");
const google_login = require("../controllers/google_auth")

router.post("/google",google_login);


module.exports = router 