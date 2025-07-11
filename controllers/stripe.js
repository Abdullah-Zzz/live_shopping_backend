const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const product_schema = require("../models/product_schema");
const mongoose = require("mongoose");

const createPaymentIntent = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided." });
    }

    let total = 0;

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: "Invalid product ID." });
      }

      const product = await product_schema.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }

      if (
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        !Number.isInteger(item.quantity)
      ) {
        return res.status(400).json({ message: "Invalid quantity for product." });
      }

      total += product.price * item.quantity;
    }

    const amountInCents = Math.round(total * 100); // To prevent floating-point issues

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: req.user?.id || "guest",
        integration: "flutter_inapp_card",
      },
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("Stripe Error:", err);

    if (err.type === "StripeCardError") {
      return res.status(402).json({ message: err.message });
    }

    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  createPaymentIntent,
};
