const product_schema = require("../models/product_schema");
const Joi = require("joi"); // for validation

const retrieve_products = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || "createdAt";
        const order = req.query.order === "asc" ? 1 : -1;

        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        if (req.query.sellerId) filter.seller = req.query.sellerId;

        const products = await product_schema
            .find(filter)
            .sort({ [sortBy]: order })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("seller", "sellerInfo");

        const total = await product_schema.countDocuments(filter);

        return res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit),
            products,
        });
    } catch (err) {
        console.error("Retrieve Products Error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
const get_seller_products = async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const filter = { seller: sellerId };
    const products = await product_schema
      .find(filter)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("seller", "sellerInfo");

    const total = await product_schema.countDocuments(filter);
    return res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (err) {
    console.error("Get Seller Products Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const get_product_by_id = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await product_schema.findById(id).populate("seller", "sellerInfo");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json(product);
  } catch (err) {
    console.error("Get Product By ID Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const sellers_products = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; 
    const sortBy = req.query.sortBy || "createdAt"; 
    const order = req.query.order === "asc" ? 1 : -1;
    const filter = { seller: sellerId };
    const products = await product_schema
      .find(filter)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("seller", "sellerInfo");
    const total = await product_schema.countDocuments(filter);
    return res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (err) {
    console.error("Sellers Products Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const add_product = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().min(5).max(1000).required(),
      price: Joi.number().min(0).required(),
      category:  Joi.array().items(Joi.string()).min(1).required(),
      images: Joi.array().items(Joi.string().uri()).min(1).required(),
      tags: Joi.array().items(Joi.string())
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, description, price, category, images,tags } = req.body;
    const product = new product_schema({
      name,
      description,
      price,
      category,
      images,
      tags,
      seller: req.user.id 
    });

    await product.save();

    return res.status(201).json({ message: "Product added successfully." });
  } catch (err) {
    console.error("Add Product Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};


const edit_product = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await product_schema.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to edit this product" });
    }

    const schema = Joi.object({
      name: Joi.string().min(2).max(100),
      description: Joi.string().min(5).max(1000),
      price: Joi.number().min(0),
      category: Joi.array().items(Joi.string()).min(1).required(),
      images: Joi.array().items(Joi.string().uri()),
      tags: Joi.array().items(Joi.string())
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const updated = await product_schema.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    res.status(200).json({ message: "Product updated"});

  } catch (err) {
    console.error("Edit Product Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const delete_product = async (req, res) => {
  try {
    const { id } = req.params;

    const prod = await product_schema.findById(id);
    if (!prod) {
      return res.status(404).json({ message: "No product with that ID" });
    }

    if (prod.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to delete this product" });
    }

    await product_schema.findByIdAndDelete(id);

    return res.status(200).json({ message: "Product deleted successfully" });

  } catch (err) {
    console.error("Delete Product Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
    retrieve_products,
    add_product,
    edit_product,
    delete_product,
    sellers_products,
    get_product_by_id,
    get_seller_products
}