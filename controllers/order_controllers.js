const user_schema = require("../models/user_schema")
const product_schema = require("../models/product_schema")
const order_schema = require("../models/order_schema")
const mongoose = require("mongoose")
const crypto = require("crypto")
const payuClient = require("./payU_config");
const joi = require("joi")

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
const change_order_status = async (req, res) => {
  const schema = joi.object({
    status: joi.string()
      .valid('pending', 'processing', 'shipped', 'delivered', 'cancelled')
      .required()
      .messages({
        'any.required': 'Status is required',
        'any.only': 'Status must be one of: pending, processing, shipped, delivered, cancelled'
      }),
    id: joi.string()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      })
      .required()
      .messages({
        'any.invalid': 'Invalid order ID format',
        'any.required': 'Order ID is required'
      })
  });

  const { error } = schema.validate({
    status: req.body.status,
    id: req.params.id
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }
  // 2. Status Transition Validation
  const validTransitions = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
  };

  try {
    const order = await order_schema.findById(req.params.id).select('status');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    if (!validTransitions[order.status].includes(req.body.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${req.body.status}`,
        code: 'INVALID_STATUS_TRANSITION',
        validNextStatuses: validTransitions[order.status]
      });
    }

    const updatedOrder = await order_schema.findByIdAndUpdate(
      req.params.id,
      { 
        status: req.body.status,
        $push: {
          statusHistory: {
            status: req.body.status,
            changedAt: new Date(),
            changedBy: req.user.id 
          }
        }
      },
      { new: true }
    );

    console.log(`Order ${req.params.id} status changed from ${order.status} to ${req.body.status} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        previousStatus: order.status,
        newStatus: updatedOrder.status
      }
    });

  } catch (err) {
    console.error('Status change error:', {
      orderId: req.params.id,
      error: err.message,
      stack: err.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      code: 'SERVER_ERROR',
      systemMessage: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

module.exports = {
  place_order,
  view_order,
  delete_order,
  edit_order,
  change_order_status
}