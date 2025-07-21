const mongoose = require("mongoose");

const attributeSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  colors: [String],
  sizes: [String]
}, { timestamps: true });

module.exports = mongoose.model("Attribute", attributeSchema);
