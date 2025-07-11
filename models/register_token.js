const mongoose = require("mongoose");

const registerTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 1800 } // auto-delete after 30 mins
});

module.exports = mongoose.model("RegisterToken", registerTokenSchema);
