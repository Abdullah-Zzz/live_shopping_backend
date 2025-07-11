const user_schema = require("../models/user_schema")
const product_schema = require("../models/product_schema")
const order_schema = require("../models/order_schema")
const mongoose = require("mongoose")
const crypto = require("crypto")
const payuClient = require("./payU_config");

const place_order = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { items, shippingAddress, payment } = req.body;

    // Validate items and shipping (your existing code)
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items in order." });
    }
    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address required." });
    }

    let totalAmount = 0;
    const verifiedItems = [];
    for (const item of items) {
      const product = await product_schema.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found.` });
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return res.status(400).json({ message: "Invalid quantity." });
      }
      verifiedItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        seller: product.seller,
        name: product.name,
        image: product.images?.[0] || ""
      });
      totalAmount += product.price * item.quantity;
    }

    if (payment?.method && !["cash_on_delivery", "pay_u"].includes(payment.method)) {
      return res.status(400).json({ message: "Invalid payment method." });
    }

    if (payment.method === "cash_on_delivery") {
      const new_order = new order_schema({
        buyer: buyerId,
        items: verifiedItems,
        totalAmount,
        shippingAddress,
        payment: {
          method: "cash_on_delivery",
          status: "pending",
          paidAt: null
        },
        status: "pending"
      });
      await new_order.save();
      return res.status(201).json({ message: "Order placed successfully", orderId: new_order._id });
    }

    if (payment.method === "pay_u") {
      const new_order = new order_schema({
        buyer: buyerId,
        items: verifiedItems,
        totalAmount,
        shippingAddress,
        payment: {
          method: "pay_u",
          status: "pending",
          paidAt: null
        },
        status: "pending"
      });
      await new_order.save();

      const txnid = `PAYU_${new_order._id}_${Date.now()}`;
      const salt_key = process.env.PAYU_SALT_64_BIT;
      const merchant_key = process.env.PAYU_MERCHANT_KEY;
      let udf1 = ''
      let udf2 = ''
      let udf3 = ''
      let udf4 = ''
      let udf5 = ''

      const hashString = `${merchant_key}|${txnid}|${totalAmount}|${"Order"}|${req.user.name || "test"}|${req.user.email || ""}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt_key}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');

      const payment_data = {
        key: merchant_key,
        txnid,
        amount: totalAmount,
        productinfo: "Order",
        firstname: req.user.name || "test",
        email: req.user.email || "",
        phone: shippingAddress.phone || "",
        surl: `${process.env.BASE_URL}/api/payu/success?order_id=${new_order._id}`,
        furl: `${process.env.BASE_URL}/api/payu/failure?order_id=${new_order._id}`,
        hash: hash, 
      };

      return res.status(200).json({
        message: "Redirect to PayU",
        payment_url: "https://test.payu.in/_payment",
        payment_data
      });
    }
  } catch (err) {
    console.error("Place Order Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const view_order = async (req, res) => {
  try {
    const user_id = new mongoose.Types.ObjectId(req.user.id);

    const orders = await order_schema
      .find({ buyer: user_id })
      .select("-buyer -payment")
      .sort({ createdAt: -1 });

    return res.status(200).json({ orders });
  } catch (err) {
    console.error("Error while viewing orders:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const delete_order = async (req, res) => {
  try {
    const user_id = new mongoose.Types.ObjectId(req.user.id)
    const order_id = new mongoose.Types.ObjectId(req.params.id)
    const order = await order_schema.findById(order_id)
    if (!order) {
      return res.status(404).json({ message: "No order with that Id" })
    }
    if (order.buyer.toString() !== user_id.toString()) {
      return res.status(403).json({ message: "Not allowed" })
    }
    if (order.status.toLowerCase() !== "pending" && order.status.toLowerCase() !== "processing") {
      return res.status(200).json({ message: "Order Already Shipped" })
    }
    await order_schema.findByIdAndDelete(order_id)
    res.status(200).json({ message: "Order deleted" })
  }
  catch (err) {
    return res.status(500).json({ message: "Internal server error" + err });
  }
}
const edit_order = async (req, res) => {
  try {
    const user_id = new mongoose.Types.ObjectId(req.user.id)
    const { id, items, shippingAddress } = req.body
    const order = await order_schema.findById(new mongoose.Types.ObjectId(id))
    for (const item of items) {
      if (
        !item.productId ||
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0
      ) {
        return res.status(400).json({ message: "Each item must have a valid productId and quantity > 0" });
      }
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and cannot be empty" });
    }
    if (!order) {
      return res.status(404).json({ message: "No order with that Id" })
    }
    if (order.buyer.toString() !== user_id.toString()) {
      return res.status(403).json({ message: "Not allowed" })
    }
    if (order.status.toLowerCase() !== "pending" && order.status.toLowerCase() !== "processing") {
      return res.status(200).json({ message: "Order Already Shipped" })
    }
    order.items = items
    if (shippingAddress) {
      order.shippingAddress = shippingAddress;
    }
    await order.save()
    res.status(200).json({ message: "Order updated" })

  }
  catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
}


module.exports = {
  place_order,
  view_order,
  delete_order,
  edit_order
}