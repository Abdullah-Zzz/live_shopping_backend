const mongoose = require("mongoose");

const reset_token_schema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 1800 } 
});

module.exports = mongoose.model("reset_token", reset_token_schema);
