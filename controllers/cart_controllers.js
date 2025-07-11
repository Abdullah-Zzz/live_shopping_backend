const mongoose = require("mongoose");
const product_schema = require("../models/product_schema");
const cart_schema = require("../models/cart_schema");

const add_item = async (req, res) => {
  try {
    const { prod_id, quantity } = req.body;

    if (typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const product_ID = new mongoose.Types.ObjectId(prod_id);
    const user_ID = new mongoose.Types.ObjectId(req.user.id)
    const product = await product_schema.findById(product_ID);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let cart = await cart_schema.findOne({ user: user_ID });

    if (!cart) {
      cart = new cart_schema({
        user: user_ID,
        items: [{ product: prod_id, quantity }],
      });
    } else {
      const existingItem = cart.items.find((item) =>
        item.product.toString() === prod_id
      );

      if (existingItem) {
        return res.status(400).json({ message: "Item Already In Cart" })
      } else {
        cart.items.push({ product: prod_id, quantity });
      }
    }

    await cart.save();

    return res.status(200).json({ message: "Item added to cart" });

  } catch (err) {
    console.error("Add Item Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const remove_item = async (req, res) => {
  try {
    const { prod_id } = req.body;

    const product_ID = new mongoose.Types.ObjectId(prod_id);
    const product = await product_schema.findById(product_ID);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user_cart = await cart_schema.findOne({ user: req.user.id });
    if (!user_cart || !user_cart.items.length) {
      return res.status(400).json({ message: "Cart is already empty." });
    }

    const itemExists = user_cart.items.some(item => item.product.toString() === prod_id);
    if (!itemExists) {
      return res.status(404).json({ message: "Item not found in cart." });
    }

    user_cart.items = user_cart.items.filter(item => item.product.toString() !== prod_id);

    await user_cart.save();

    return res.status(200).json({ message: "Item removed from cart." });

  } catch (err) {
    console.error("Remove Item Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const update_quantity = async (req, res) => {
  try {
    const { prod_id, quantity } = req.body;

    if (typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity provided." });
    }

    const product_ID = new mongoose.Types.ObjectId(prod_id);
    const product = await product_schema.findById(product_ID);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    let user_cart = await cart_schema.findOne({ user: req.user.id });
    if (!user_cart || !user_cart.items.length) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    const itemIndex = user_cart.items.findIndex(
      item => item.product.toString() === prod_id
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart." });
    }

    user_cart.items[itemIndex].quantity = quantity;

    await user_cart.save();

    return res.status(200).json({ message: "Quantity updated successfully." });
  } catch (err) {
    console.error("Update Quantity Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
const view_items = async (req, res) => {
  try {
    const user_id = new mongoose.Types.ObjectId(req.user.id);
    
    const cart = await cart_schema.findOne({ user: user_id }).populate("items.product");
    
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    const items = cart.items.map(item => ({
      productId: item.product._id,
      name: item.product.name,
      description : item.product.description,
      price: item.product.price,
      category: item.product.category,
      images: item.product.images?.[0] || null,
      quantity: item.quantity,
      tags : item.product.tags,
      ratings : item.product.ratings
    }));

    return res.status(200).json({ items });

  } catch (err) {
    console.error("View Cart Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
const clear_cart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await cart_schema.findOne({ user: userId });
    if (!cart || !cart.items.length) {
      return res.status(404).json({ message: "Cart is already empty." });
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({ message: "Cart emptied successfully." });
  } catch (err) {
    console.error("Clear Cart Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};


module.exports = {
  add_item,
  remove_item,
  update_quantity,
  view_items,
  clear_cart
}