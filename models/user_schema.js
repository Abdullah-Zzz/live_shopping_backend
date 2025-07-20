const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address"]
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, "Please use a valid phone number"],
      default: "",
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
      default: "",
    },
    dateOfBirth: {
      type: Date,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer"
    },
    isProfileComplete: { 
      type: Boolean, 
      default: false 
    },
    isSellerVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    avatar: {
      url: { type: String, default: "" },
    },
    sellerInfo: {
      shopName: {
        type: String,
        required: function() { return this.role === "seller"; },
        default: "",
      },
      description: { type: String, default: "" },
      logo: {
        public_id: { type: String, default: "" },
        url: { type: String, default: "" }
      },
      address: {
        type: String,
        required: function() { return this.role === "seller"; },
        default: "",
      },
      contact: {
        phone: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
        website: { type: String, default: "" }
      },
      socialMedia: {
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        twitter: { type: String, default: "" },
        youtube: { type: String, default: "" }
      },
      paymentInfo: {
        bankName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        accountName: { type: String, default: "" },
        taxId: { type: String, default: "" }
      },
      rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
      }
    },
    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpire: Date,
    lastLogin: Date
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isSellerVerified: 1 });

module.exports = mongoose.model("User", userSchema);