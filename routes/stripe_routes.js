const express = require("express");
const router = express.Router();
const { createPaymentIntent } = require("../controllers/stripe");
const { auth } = require("../middleware/auth"); 

router.post("/create-payment-intent", auth, createPaymentIntent);

module.exports = router;
