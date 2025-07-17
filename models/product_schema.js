const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    minlength: [2, "Product name must be at least 2 characters"],
    maxlength: [100, "Product name cannot exceed 100 characters"],
    index: true
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    maxlength: [2000, "Description cannot exceed 2000 characters"]
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0.01, "Price must be at least 0.01"]
  },
  originalPrice: {
    type: Number,
    min: [0.01, "Original price must be at least 0.01"]
  },
  discount: {
    type: Number,
    min: [0, "Discount cannot be negative"],
    max: [100, "Discount cannot exceed 100%"]
  },
  category: {
    type: [String],
    required: [true, "At least one category is required"],
    validate: { 
      validator: function(arr) {
        return arr.length > 0;
      },
      message: "At least one category is required"
    },
    index: true
  },
  images: {
    type: [String],
    required: [true, "At least one image is required"],
    validate: { 
      validator: function(arr) {
        return arr.length > 0;
      },
      message: "At least one image is required"
    }
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Seller reference is required"],
    index: true
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: [true, "Store reference is required"],
    index: true
  },
  ratings: {
    average: { 
      type: Number, 
      default: 0,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot exceed 5"]
    },
    count: { 
      type: Number, 
      default: 0,
      min: 0
    }
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  specifications: [{
    key: String,
    value: String
  }],
  shippingInfo: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    shippingClass: String
  },
  statusHistory: [{
    status: String,
    changedAt: Date,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ seller: 1, isActive: 1 });
productSchema.index({ store: 1, isActive: 1 });
productSchema.index({ "ratings.average": -1 });
productSchema.index({ createdAt: -1 });

productSchema.pre("save", function(next) {
  if (this.isModified("price") && !this.originalPrice) {
    this.originalPrice = this.price;
  }
  
  if (this.originalPrice && this.price) {
    this.discount = Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);