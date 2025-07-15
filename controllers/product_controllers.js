const Product = require("../models/product_schema");
const Store = require("../models/vendor_store");
const Joi = require("joi");

// Get all products with pagination and filtering
const retrieveProducts = async (req, res) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sortBy: Joi.string().valid("createdAt", "price", "name", "ratings.average").default("createdAt"),
      order: Joi.string().valid("asc", "desc").default("desc"),
      category: Joi.string(),
      sellerId: Joi.string(),
      minPrice: Joi.number().min(0),
      maxPrice: Joi.number().min(0),
      search: Joi.string(),
      isActive: Joi.boolean()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { 
      page, 
      limit, 
      sortBy, 
      order, 
      category, 
      sellerId, 
      minPrice, 
      maxPrice, 
      search,
      isActive
    } = value;

    const filter = {};
    if (category) filter.category = category;
    if (sellerId) filter.seller = sellerId;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = minPrice;
      if (maxPrice) filter.price.$lte = maxPrice;
    }
    if (typeof isActive !== "undefined") filter.isActive = isActive;
    if (search) {
      filter.$text = { $search: search };
    }

    const sortOption = { [sortBy]: order === "asc" ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("seller", "name avatar sellerInfo")
        .populate("store", "storeName slug"),
      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      products
    });

  } catch (err) {
    console.error("Retrieve Products Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Get products by seller ID
const getSellerProducts = async (req, res) => {
  try {
    const schema = Joi.object({
      sellerId: Joi.string().required(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sortBy: Joi.string().valid("createdAt", "price", "name", "ratings.average").default("createdAt"),
      order: Joi.string().valid("asc", "desc").default("desc")
    });

    const { error, value } = schema.validate({
      ...req.query,
      sellerId: req.params.sellerId
    });
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { page, limit, sortBy, order } = value;
    const filter = { seller: value.sellerId, isActive: true };

    const sortOption = { [sortBy]: order === "asc" ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("store", "storeName slug"),
      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      products
    });

  } catch (err) {
    console.error("Get Seller Products Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate("seller", "name avatar sellerInfo")
      .populate("store", "storeName slug");

    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    if (!product.isActive && (!req.user || req.user.role !== "admin")) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      product 
    });

  } catch (err) {
    console.error("Get Product By ID Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Get current seller's products
const getCurrentSellerProducts = async (req, res) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sortBy: Joi.string().valid("createdAt", "price", "name", "ratings.average").default("createdAt"),
      order: Joi.string().valid("asc", "desc").default("desc"),
      isActive: Joi.boolean()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { page, limit, sortBy, order, isActive } = value;
    const filter = { seller: req.user.id };
    if (typeof isActive !== "undefined") filter.isActive = isActive;

    const sortOption = { [sortBy]: order === "asc" ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("store", "storeName slug"),
      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      products
    });

  } catch (err) {
    console.error("Get Seller Products Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Add new product
const addProduct = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().min(5).max(2000).required(),
      price: Joi.number().min(0.01).required(),
      originalPrice: Joi.number().min(0.01),
      category: Joi.array().items(Joi.string()).min(1).required(),
      images: Joi.array().items(Joi.string().uri()).min(1).required(),
      tags: Joi.array().items(Joi.string()),
      stock: Joi.number().integer().min(0).default(0),
      isActive: Joi.boolean().default(true),
      specifications: Joi.array().items(
        Joi.object({
          key: Joi.string().required(),
          value: Joi.string().required()
        })
      ),
      shippingInfo: Joi.object({
        weight: Joi.number().min(0),
        dimensions: Joi.object({
          length: Joi.number().min(0),
          width: Joi.number().min(0),
          height: Joi.number().min(0)
        }),
        shippingClass: Joi.string()
      })
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { 
      name, 
      description, 
      price, 
      originalPrice,
      category, 
      images, 
      tags, 
      stock,
      isActive,
      specifications,
      shippingInfo
    } = value;

    // Check if seller has a store
    const store = await Store.findOne({ seller: req.user.id });
    if (!store) {
      return res.status(400).json({ 
        success: false,
        message: "You need to have a store to add products" 
      });
    }

    const productData = {
      name,
      description,
      price,
      originalPrice: originalPrice || price,
      category,
      images,
      tags: tags || [],
      stock,
      isActive,
      seller: req.user.id,
      store: store._id
    };

    if (specifications) {
      productData.specifications = specifications;
    }

    if (shippingInfo) {
      productData.shippingInfo = shippingInfo;
    }

    const product = new Product(productData);
    await product.save();

    // Add product to store
    store.products.push(product._id);
    store.metrics.totalProducts += 1;
    await store.save();

    return res.status(201).json({ 
      success: true,
      message: "Product added successfully",
      product 
    });

  } catch (err) {
    console.error("Add Product Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Edit product
const editProduct = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100),
      description: Joi.string().min(5).max(2000),
      price: Joi.number().min(0.01),
      originalPrice: Joi.number().min(0.01),
      category: Joi.array().items(Joi.string()).min(1),
      images: Joi.array().items(Joi.string().uri()).min(1),
      tags: Joi.array().items(Joi.string()),
      stock: Joi.number().integer().min(0),
      isActive: Joi.boolean(),
      specifications: Joi.array().items(
        Joi.object({
          key: Joi.string().required(),
          value: Joi.string().required()
        })
      ),
      shippingInfo: Joi.object({
        weight: Joi.number().min(0),
        dimensions: Joi.object({
          length: Joi.number().min(0),
          width: Joi.number().min(0),
          height: Joi.number().min(0)
        }),
        shippingClass: Joi.string()
      })
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    // Check if the current user is the product owner or admin
    if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false,
        message: "Unauthorized to edit this product" 
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id, 
      { $set: value }, 
      { new: true }
    );

    return res.status(200).json({ 
      success: true,
      message: "Product updated successfully",
      product: updatedProduct 
    });

  } catch (err) {
    console.error("Edit Product Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    // Check if the current user is the product owner or admin
    if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false,
        message: "Unauthorized to delete this product" 
      });
    }

    // Remove product from store
    await Store.updateOne(
      { _id: product.store },
      { 
        $pull: { products: product._id },
        $inc: { "metrics.totalProducts": -1 }
      }
    );

    await Product.findByIdAndDelete(id);

    return res.status(200).json({ 
      success: true,
      message: "Product deleted successfully" 
    });

  } catch (err) {
    console.error("Delete Product Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

module.exports = {
  retrieveProducts,
  getSellerProducts,
  getProductById,
  getCurrentSellerProducts,
  addProduct,
  editProduct,
  deleteProduct
};