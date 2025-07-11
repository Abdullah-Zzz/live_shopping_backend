const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    phone: {
      type: String,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer"
    },
    isProfileComplete : { type: Boolean, default: false },
    avatar: {
      public_id: String,
      url: String
    },
    sellerInfo: {
      shopName: String,
      description: String,
      logo: {
        public_id: String,
        url: String
      },
      address : {
        type: String,
        required: function () {
          return this.role === "seller";
        }
      },
      rating: {
        type: Number,
      }
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date
  },
  { timestamps: true },
  
);

module.exports= new mongoose.model('users',userSchema)