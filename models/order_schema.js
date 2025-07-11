const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [
    {
      product: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,
        images: [String],
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  shippingAddress: {
    fullName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  payment: {
    method: {
      type: String,
      enum: ["cash_on_delivery", "pay_u"],
      default: "cash_on_delivery"
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending"
    },
    transactionId: String
  },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
    default: "pending"
  },
  orderedAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
