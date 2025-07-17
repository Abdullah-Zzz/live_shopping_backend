const Order = require("../models/order_schema");
const Product = require("../models/product_schema");
const Store = require("../models/vendor_store");
const User = require("../models/user_schema");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Joi = require("joi");

const payuClient = require("./payU_config"); // Assuming this is configured

// Place a new order
const placeOrder = async (req, res) => {
  try {
    const schema = Joi.object({
      items: Joi.array().items(
        Joi.object({
          productId: Joi.string().required(),
          quantity: Joi.number().integer().min(1).required()
        })
      ).min(1).required(),
      shippingAddress: Joi.object({
        fullName: Joi.string().required(),
        addressLine1: Joi.string().required(),
        addressLine2: Joi.string().allow(""),
        city: Joi.string().required(),
        state: Joi.string().required(),
        postalCode: Joi.string().required(),
        country: Joi.string().required(),
        phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required()
      }).required(),
      payment: Joi.object({
        method: Joi.string().valid("cash_on_delivery", "pay_u").required()
      }).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { items, shippingAddress, payment } = value;
    const buyerId = req.user.id;

    let totalAmount = 0;
    const verifiedItems = [];
    const productUpdates = [];
    const storeUpdates = new Map();

    for (const item of items) {
      const product = await Product.findById(item.productId).populate("store", "_id seller");

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.productId} not found`
        });
      }

      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not available`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${product.name}`
        });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      verifiedItems.push({
        product: product._id,
        price: product.price,
        name: product.name,
        seller: product.store.seller,
        store: product.store._id,
        image: product.images[0],
        quantity: item.quantity,
        status: "pending",
        refundStatus: "none"
      });

      productUpdates.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $inc: { stock: -item.quantity } }
        }
      });

      if (!storeUpdates.has(product.store._id.toString())) {
        storeUpdates.set(product.store._id.toString(), {
          storeId: product.store._id,
          sellerId: product.store.seller,
          amount: 0,
          items: []
        });
      }

      const storeUpdate = storeUpdates.get(product.store._id.toString());
      storeUpdate.amount += itemTotal;
      storeUpdate.items.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price
      });
    }

    const orderData = {
      buyer: buyerId,
      items: verifiedItems,
      totalAmount,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      shippingAddress,
      payment: {
        method: payment.method,
        status: "pending"
      },
      status: "pending",
      notes: {
        buyer: "",
        seller: "",
        admin: ""
      },
      tracking: {
        carrier: "",
        trackingNumber: "",
        trackingUrl: "",
        estimatedDelivery: null
      },
      flags: {
        requiresAttention: false,
        priority: 1,
        isFraud: false
      }
    };

    const order = new Order(orderData);
    await order.save();

    if (payment.method === "cash_on_delivery") {
      await Product.bulkWrite(productUpdates);

      for (const [, storeUpdate] of storeUpdates) {
        await Store.findByIdAndUpdate(storeUpdate.storeId, {
          $push: { orders: order._id },
          $inc: { "metrics.totalSales": storeUpdate.amount }
        });
      }

      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        orderId: order._id
      });
    } else if (payment.method === "pay_u") {
      const txnid = `PAYU_${order._id}_${Date.now()}`;
      const saltKey = process.env.PAYU_SALT_64_BIT;
      const merchantKey = process.env.PAYU_MERCHANT_KEY;

      const hashString = `${merchantKey}|${txnid}|${totalAmount}|Order|${req.user.name}|${req.user.email}||||||||||${saltKey}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const paymentData = {
        key: merchantKey,
        txnid,
        amount: totalAmount,
        productinfo: "Order",
        firstname: req.user.name,
        email: req.user.email,
        phone: shippingAddress.phone,
        surl: `${process.env.BASE_URL}/api/payu/success?order_id=${order._id}`,
        furl: `${process.env.BASE_URL}/api/payu/failure?order_id=${order._id}`,
        hash
      };

      return res.status(200).json({
        success: true,
        message: "Redirect to payment gateway",
        paymentUrl: "https://test.payu.in/_payment",
        paymentData
      });
    }
  } catch (err) {
    console.error("Place Order Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// View user's orders
const viewOrders = async (req, res) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      status: Joi.string().valid(
        "pending", "processing", "shipped", "delivered", "cancelled", "returned"
      ),
      sortBy: Joi.string().valid("orderedAt", "deliveredAt", "totalAmount").default("orderedAt"),
      order: Joi.string().valid("asc", "desc").default("desc")
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { page, limit, status, sortBy, order } = value;
    const filter = { buyer: req.user.id };
    if (status) filter.status = status;

    const sortOption = { [sortBy]: order === "asc" ? 1 : -1 };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("items.product", "name images")
        .populate("items.seller", "name")
        .populate("items.store", "storeName"),
      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders
    });

  } catch (err) {
    console.error("View Orders Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Delete an order (only if status allows)
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.buyer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this order"
      });
    }

    // Only allow deletion if order is pending or processing
    if (!["pending", "processing"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete order with status ${order.status}`
      });
    }

    // Restore product stocks
    const productUpdates = order.items.map(item => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.quantity } }
      }
    }));

    // Update store metrics
    const storeUpdates = {};
    order.items.forEach(item => {
      if (!storeUpdates[item.store]) {
        storeUpdates[item.store] = 0;
      }
      storeUpdates[item.store] += item.price * item.quantity;
    });

    await Promise.all([
      Order.findByIdAndDelete(id),
      Product.bulkWrite(productUpdates),
      ...Object.entries(storeUpdates).map(([storeId, amount]) =>
        Store.findByIdAndUpdate(storeId, {
          $inc: { "metrics.totalSales": -amount }
        })
      )
    ]);

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully"
    });

  } catch (err) {
    console.error("Delete Order Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Edit order (only certain fields before shipping)
const editOrder = async (req, res) => {
  try {
    const schema = Joi.object({
      shippingAddress: Joi.object({
        fullName: Joi.string(),
        addressLine1: Joi.string(),
        addressLine2: Joi.string().allow(""),
        city: Joi.string(),
        state: Joi.string(),
        postalCode: Joi.string(),
        country: Joi.string(),
        phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/)
      }),
      buyerNotes: Joi.string().allow("")
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.buyer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to edit this order"
      });
    }

    // Only allow editing if order is pending or processing
    if (!["pending", "processing"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit order with status ${order.status}`
      });
    }

    // Update allowed fields
    if (value.shippingAddress) {
      order.shippingAddress = { ...order.shippingAddress, ...value.shippingAddress };
    }
    if (value.buyerNotes !== undefined) {
      order.notes.buyer = value.buyerNotes;
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order
    });

  } catch (err) {
    console.error("Edit Order Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Change order status (admin/seller only)
const changeOrderStatus = async (req, res) => {
  try {
    const schema = Joi.object({
      status: Joi.string()
        .valid("pending", "processing", "shipped", "delivered", "cancelled", "returned")
        .required(),
      notes: Joi.string().allow("")
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { id } = req.params;
    const { status, notes } = value;
    const userId = req.user.id;
    const userRole = req.user.role;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Validate status transition
    const validTransitions = {
      pending: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered", "returned"],
      delivered: ["returned"],
      cancelled: [],
      returned: []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}`,
        validNextStatuses: validTransitions[order.status]
      });
    }

    // Check permissions
    if (userRole === "seller") {
      // Seller can only update their own items
      const sellerItems = order.items.filter(item =>
        item.seller.toString() === userId
      );

      if (sellerItems.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to update this order"
        });
      }

      // For seller, only allow updating their items' status
      for (const item of sellerItems) {
        item.status = status;
      }

      // Update overall order status if all items have the same status
      const allItemsSameStatus = order.items.every(item =>
        item.status === order.items[0].status
      );

      if (allItemsSameStatus) {
        order.status = order.items[0].status;
      } else {
        order.status = "processing"; // Mixed statuses
      }
    } else if (userRole === "admin") {
      // Admin can update entire order status
      order.status = status;
      order.items.forEach(item => {
        item.status = status;
      });
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update order status"
      });
    }

    // Add to status history
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: userId,
      notes
    });

    // Set deliveredAt if status is delivered
    if (status === "delivered") {
      order.deliveredAt = new Date();
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order
    });

  } catch (err) {
    console.error("Change Order Status Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Admin-only: Get all orders
const getAllOrders = async (req, res) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      status: Joi.string().valid(
        "pending", "processing", "shipped", "delivered", "cancelled", "returned"
      ),
      sellerId: Joi.string(),
      buyerId: Joi.string(),
      sortBy: Joi.string().valid("orderedAt", "deliveredAt", "totalAmount").default("orderedAt"),
      order: Joi.string().valid("asc", "desc").default("desc"),
      startDate: Joi.date(),
      endDate: Joi.date()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { page, limit, status, sellerId, buyerId, sortBy, order, startDate, endDate } = value;
    const filter = {};

    if (status) filter.status = status;
    if (sellerId) filter["items.seller"] = sellerId;
    if (buyerId) filter.buyer = buyerId;

    if (startDate || endDate) {
      filter.orderedAt = {};
      if (startDate) filter.orderedAt.$gte = new Date(startDate);
      if (endDate) filter.orderedAt.$lte = new Date(endDate);
    }

    const sortOption = { [sortBy]: order === "asc" ? 1 : -1 };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("buyer", "name email")
        .populate("items.seller", "name email")
        .populate("items.store", "storeName"),
      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders
    });

  } catch (err) {
    console.error("Get All Orders Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Admin-only: Cancel order
const adminCancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Only allow cancellation if order is pending or processing
    if (!["pending", "processing"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status ${order.status}`
      });
    }

    // Restore product stocks
    const productUpdates = order.items.map(item => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.quantity } }
      }
    }));

    // Update store metrics
    const storeUpdates = {};
    order.items.forEach(item => {
      if (!storeUpdates[item.store]) {
        storeUpdates[item.store] = 0;
      }
      storeUpdates[item.store] += item.price * item.quantity;
    });

    // Update order status
    order.status = "cancelled";
    order.items.forEach(item => {
      item.status = "cancelled";
    });

    order.statusHistory.push({
      status: "cancelled",
      changedAt: new Date(),
      changedBy: req.user.id,
      notes: "Cancelled by admin"
    });

    await Promise.all([
      order.save(),
      Product.bulkWrite(productUpdates),
      ...Object.entries(storeUpdates).map(([storeId, amount]) =>
        Store.findByIdAndUpdate(storeId, {
          $inc: { "metrics.totalSales": -amount }
        })
      )
    ]);

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully"
    });

  } catch (err) {
    console.error("Admin Cancel Order Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  placeOrder,
  viewOrders,
  deleteOrder,
  editOrder,
  changeOrderStatus,
  getAllOrders,
  adminCancelOrder
};