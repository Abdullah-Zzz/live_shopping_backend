const express = require("express")
const router = express.Router()
const { auth_limiter } = require("../middleware/auth_limiter")
const crypto = require("crypto")
const order_schema = require("../models/order_schema")

router.post("/success", (req, res) => {

  console.log("Payment succeeded:", req.body);
  res.status(200).json({ success: true, message: "Payment succeeded" })
});

router.post("/failure", (req, res) => {
  console.log("Payment failed:", req.body);
  res.status(200).json({ success: false, message: "Payment failed" })

});

router.post('/webhook', async (req, res) => {
  try{

  const payload = req.body;
  const receivedHash = payload.hash;

  const salt = process.env.PAYU_SALT_64_BIT;
  const hashString = [
    salt,
    payload.status,
    payload.txnid,
    payload.amount,
    payload.productinfo,
    payload.firstname,
    payload.email,
    payload.udf1 || "",
    payload.udf2 || "",
    payload.udf3 || "",
    payload.udf4 || "",
    payload.udf5 || ""
  ].join('|');

  const expectedHash = crypto
    .createHash('sha512')
    .update(hashString)
    .digest('hex');

  if (receivedHash !== expectedHash) {
    console.error("⚠️ Invalid hash - Possible fraud!");
    return res.status(403).send({message : "Invalid hash"});
  }

  const orderId = payload.txnid.split('_')[1];
  if (!orderId) {
    return res.status(400).json({ error: "Order ID not found" });
  }
  const status = payload.status.toLowerCase();
  const updateData = {
    'payment.status': status === 'success' ? 'completed' : 'failed',
    'payment.paidAt': status === 'success' ? new Date() : null
  };
  await order_schema.findByIdAndUpdate(orderId, { $set: updateData });

  res.status(200).send({message : "Webhook processed"});
  }
  catch(err){
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


function verifyPayUHash(data) {
  const hashString = [
    data.key,
    data.txnid,
    data.amount,
    data.productinfo,
    data.firstname,
    data.email,
    "", "", "", "", "", "", "", "", "",
    process.env.PAYU_SALT_64_BIT,
  ].join("|");

  const generatedHash = crypto.createHash("sha512").update(hashString).digest("hex");
  return generatedHash === data.hash;
}

module.exports = router