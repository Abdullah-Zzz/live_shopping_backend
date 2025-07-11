const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    //   stock: {
    //     type: Number,
    //     required: true,
    //     min: 0
    //   },
    category: {
        type: [String],
        required: true,
        validate: { 
            validator: function (arr) {
                return arr.length > 0;
            },
            message: "At least one category is required"
        }
    }
    ,
    // images: [
    //     {
    //         url: { type: String, required: true },
    //         public_id: { type: String } // if you're using Cloudinary
    //     }
    // ]
    images: {
        type: [String],
        required: true,
        validate: { 
            validator: function (arr) {
                return arr.length > 0;
            },
            message: "At least one category is required"
        }
    },
    tags: {
        type: [String],
        required: true,
        validate: { 
            validator: function (arr) {
                return arr.length > 0;
            },
            message: "At least one category is required"
        }
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    ratings: {
        avg: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now   
    }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
