const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Seller reference is required"],
      unique: true,
    },
    storeName: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
      maxlength: [50, "Store name cannot exceed 50 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: []
    }],
    orders: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: []
    }],
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    contact: {
      email: {
        type: String,
        match: [/\S+@\S+\.\S+/, "Please use a valid email address"]
      },
      phone: {
        type: String,
        required: [true, "Contact phone is required"]
      },
      whatsapp: String,
      website: String
    },
    address: String,
    media: {
      logo: {
        public_id: String,
        url: { type: String, default: "default_logo_url.jpg" }
      },
      banner: {
        public_id: String,
        url: String
      }
    },
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      youtube: String,
      tiktok: String
    },
    businessInfo: {
      bankDetails: {
        accountName: { type: String, select: false },
        accountNumber: { type: String, select: false },
        bankName: { type: String, select: false },
        iban: { type: String, select: false }
      },
      taxInfo: {
        taxId: { type: String, select: false },
        vatNumber: { type: String, select: false }
      }
    },
    metrics: {
      totalProducts: { type: Number, default: 0 },
      totalSales: { type: Number, default: 0 },
      averageRating: { 
        type: Number, 
        default: 0, 
        min: 0, 
        max: 5 
      },
      totalReviews: { type: Number, default: 0 }
    },
    settings: {
      isActive: { type: Boolean, default: true },
      acceptReturns: { type: Boolean, default: false },
      notificationPrefs: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true }
      }
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },
    verificationNotes: String
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save hook for slug generation
storeSchema.pre("save", function(next) {
  if (!this.isModified("storeName")) return next();

  this.slug = this.storeName
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
  next();
});

storeSchema.methods.updateMetrics = async function() {
  const Product = mongoose.model("Product");
  const Review = mongoose.model("Review");

  const [productCount, reviews] = await Promise.all([
    Product.countDocuments({ store: this._id }),
    Review.find({ "product.store": this._id })
  ]);

  this.metrics.totalProducts = productCount;
  this.metrics.totalReviews = reviews.length;

  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    this.metrics.averageRating = parseFloat(avgRating.toFixed(1));
  }

  await this.save();
};

// Indexes
storeSchema.index({ slug: 1 });
storeSchema.index({ seller: 1 });
storeSchema.index({ "metrics.averageRating": -1 });
storeSchema.index({ "metrics.totalSales": -1 });

module.exports = mongoose.model("Store", storeSchema);