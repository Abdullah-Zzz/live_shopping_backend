const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [true, "Product reference is required"]
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0.01, "Price must be at least 0.01"]
  },
  name: {
    type: String,
    required: [true, "Product name is required"]
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Seller reference is required"]
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: [true, "Store reference is required"]
  },
  image: {
    type: String,
    required: [true, "Product image is required"]
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [1, "Quantity must be at least 1"]
  },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
    default: "pending"
  },
  refundStatus: {
    type: String,
    enum: ["none", "requested", "approved", "rejected", "processed"],
    default: "none"
  }
});

const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Buyer reference is required"],
    index: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: [true, "Total amount is required"],
    min: [0.01, "Total amount must be at least 0.01"]
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: [true, "Final amount is required"],
    min: [0.01, "Final amount must be at least 0.01"]
  },
  shippingAddress: {
    fullName: {
      type: String,
      required: [true, "Full name is required"]
    },
    addressLine1: {
      type: String,
      required: [true, "Address line 1 is required"]
    },
    addressLine2: String,
    city: {
      type: String,
      required: [true, "City is required"]
    },
    state: {
      type: String,
      required: [true, "State is required"]
    },
    postalCode: {
      type: String,
      required: [true, "Postal code is required"]
    },
    country: {
      type: String,
      required: [true, "Country is required"]
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+?[0-9]{10,15}$/, "Please use a valid phone number"]
    }
  },
  payment: {
    method: {
      type: String,
      enum: ["cash_on_delivery", "pay_u", "stripe", "paypal"],
      default: "cash_on_delivery"
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending"
    },
    transactionId: String,
    paymentDetails: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
    default: "pending",
    index: true
  },
  orderedAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date,
  tracking: {
    carrier: String,
    trackingNumber: String,
    trackingUrl: String,
    estimatedDelivery: Date
  },
  notes: {
    seller: String,
    buyer: String,
    admin: String
  },
  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    notes: String
  }],
  flags: {
    requiresAttention: {
      type: Boolean,
      default: false
    },
    priority: { 
      type: Number, 
      min: 1, 
      max: 3,
      default: 1
    },
    isFraud: {
      type: Boolean,
      default: false
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ "items.seller": 1, status: 1 });
orderSchema.index({ "items.store": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "payment.status": 1 });

// Pre-save hook for final amount calculation
orderSchema.pre("save", function(next) {
  if (this.isModified("totalAmount") || this.isModified("discountAmount") || 
      this.isModified("shippingAmount") || this.isModified("taxAmount")) {
    this.finalAmount = this.totalAmount - this.discountAmount + this.shippingAmount + this.taxAmount;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);