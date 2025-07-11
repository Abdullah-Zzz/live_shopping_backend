const PayU = require("payu-websdk");

const payuClient = new PayU(
  {
    key: process.env.PAYU_MERCHANT_KEY,
    salt: process.env.PAYU_SALT_64_BIT,
  },
  process.env.PAYU_ENVIRONMENT || "TEST" 
);

module.exports = payuClient; 