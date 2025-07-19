const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Seller reference is required"],
      unique: true
    },
    storeName: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
      maxlength: [50, "Store name cannot exceed 50 characters"]
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    products: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Product",
      default: []
    },
    orders: {
      type: [
        {
          buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
          },
          product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
          },
          quantity: {
            type: Number,
            required: true,
            min: [1, "Quantity must be at least 1"]
          },
          order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true
          },
          amount: {
            type: Number,
            required: true,
            min: [0.01, "Amount must be at least 0.01"]
          }
        }
      ],
      default: []
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    contact: {
      email: {
        type: String,
        trim: true,
        match: [/\S+@\S+\.\S+/, "Please use a valid email address"]
      },
      phone: {
        type: String,
        required: [true, "Contact phone is required"],
        trim: true
      },
      whatsapp: {
        type: String,
        trim: true
      },
      website: {
        type: String,
        trim: true
      }
    },
    address: {
      type: String,
      trim: true
    },
    media: {
      logo: {
        public_id: { type: String, trim: true },
        url: {
          type: String,
          default: "default_logo_url.jpg",
          trim: true
        }
      },
      banner: {
        public_id: { type: String, trim: true },
        url: { type: String, trim: true }
      }
    },
    socialMedia: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      twitter: { type: String, trim: true },
      youtube: { type: String, trim: true },
      tiktok: { type: String, trim: true }
    },
    businessInfo: {
      bankDetails: {
        accountName: { type: String, select: false, trim: true },
        accountNumber: { type: String, select: false, trim: true },
        bankName: { type: String, select: false, trim: true },
        iban: { type: String, select: false, trim: true }
      },
      taxInfo: {
        taxId: { type: String, select: false, trim: true },
        vatNumber: { type: String, select: false, trim: true }
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
    verificationNotes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Slug generation hook
storeSchema.pre("save", function (next) {
  if (!this.isModified("storeName")) return next();

  this.slug = this.storeName
    .toLowerCase()
    .trim()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");

  next();
});

// Update store metrics from associated models
storeSchema.methods.updateMetrics = async function () {
  const Product = mongoose.model("Product");
  const Review = mongoose.model("Review");

  const [productCount, reviews] = await Promise.all([
    Product.countDocuments({ store: this._id }),
    Review.find({ "product.store": this._id }) // Make sure this path is indexed
  ]);

  this.metrics.totalProducts = productCount;
  this.metrics.totalReviews = reviews.length;

  if (reviews.length > 0) {
    const avgRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) /
      reviews.length;
    this.metrics.averageRating = parseFloat(avgRating.toFixed(1));
  }

  await this.save();
};

// Indexes for performance
storeSchema.index({ slug: 1 });
storeSchema.index({ seller: 1 });
storeSchema.index({ "metrics.averageRating": -1 });
storeSchema.index({ "metrics.totalSales": -1 });

module.exports = mongoose.model("Store", storeSchema);
