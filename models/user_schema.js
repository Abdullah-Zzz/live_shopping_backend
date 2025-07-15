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
    phone: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, "Please use a valid phone number"]
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
      public_id: String,
      url: String
    },
    sellerInfo: {
      shopName: {
        type: String,
        required: function() { return this.role === "seller"; }
      },
      description: String,
      logo: {
        public_id: String,
        url: String
      },
      address: {
        type: String,
        required: function() { return this.role === "seller"; }
      },
      contact: {
        phone: String,
        whatsapp: String,
        website: String
      },
      socialMedia: {
        facebook: String,
        instagram: String,
        twitter: String,
        youtube: String
      },
      paymentInfo: {
        bankName: String,
        accountNumber: String,
        accountName: String,
        taxId: String
      },
      rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
      }
    },
    resetPasswordToken: String,
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