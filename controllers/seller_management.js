const Order = require('../models/order_schema');
const Store = require('../models/vendor_store');
const User = require("../models/user_schema.js");
const Product = require("../models/product_schema.js");

const mongoose = require('mongoose');


const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user.id;

    const store = await Store.findOne({ seller: sellerId });

    if (!store) {
      return res.status(404).json({ success: false, message: "No store found" });
    }

    const orders = await Order.find({ "items.seller": sellerId })
      .populate("buyer", "name email")
      .populate("items.product", "name images")
      .populate("items.store", "storeName");

    // Filter only the items for this seller
    const sellerOrders = orders.flatMap(order => {
      return order.items
        .filter(item => item.seller.toString() === sellerId.toString())
        .map(item => ({
          orderId: order._id,
          buyer: {
            _id: order.buyer._id,
            name: order.buyer.name,
            email: order.buyer.email
          },
          product: {
            _id: item.product?._id,
            name: item.product?.name,
            image: item.product?.images?.[0] || ""
          },
          quantity: item.quantity,
          price: item.price,
          status: item.status,
          orderedAt: order.orderedAt,
          paymentStatus: order.payment.status
        }));
    });

    return res.status(200).json({
      success: true,
      orders: sellerOrders
    });

  } catch (error) {
    console.error("Error in getSellerOrders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching seller orders"
    });
  }
};


const statusTransitions = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: []
};

const updateOrderStatus = async (orderId, sellerId, newStatus, notes = '') => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({
      _id: orderId,
      'items.seller': sellerId
    }).session(session);

    if (!order) throw new Error('Order not found or unauthorized');

    if (!statusTransitions[order.status]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
    }

    // Special handling for shipping
    if (newStatus === 'shipped') {
      if (!order.tracking?.trackingNumber) {
        throw new Error('Tracking number required before shipping');
      }
      order.shippedAt = new Date();
    }

    // Calculate the change in sales for store metrics
    let salesChange = 0;
    let shouldAddToStoreOrders = false;
    let shouldRemoveFromStoreOrders = false;

    if (newStatus === 'delivered' && order.status !== 'delivered') {
      // Add sales when order is delivered
      salesChange = order.totalAmount;
      shouldAddToStoreOrders = true;
    } else if (newStatus === 'cancelled' && order.status !== 'cancelled') {
      // Subtract sales when order is cancelled
      salesChange = -order.totalAmount;
      shouldRemoveFromStoreOrders = true;
    }

    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      changedBy: sellerId,
      notes,
      timestamp: new Date()
    });

    await order.save({ session });

    // Update store metrics and orders if there's a sales change
    if (salesChange !== 0) {
      const store = await Store.findOne({ seller: sellerId }).session(session);
      if (store) {
        store.metrics.totalSales += salesChange;
        
        // Update store orders array
        if (shouldAddToStoreOrders) {
          // Add order to store's orders array
          const orderItems = order.items.filter(item => item.seller.toString() === sellerId);
          orderItems.forEach(item => {
            store.orders.push({
              buyer: order.buyer,
              product: item.product,
              quantity: item.quantity,
              order: order._id,
              amount: item.price * item.quantity
            });
          });
        } else if (shouldRemoveFromStoreOrders) {
          // Remove order from store's orders array
          store.orders = store.orders.filter(storeOrder => 
            storeOrder.order.toString() !== order._id.toString()
          );
        }
        
        await store.save({ session });
      }
    }

    await session.commitTransaction();

    // Trigger notifications
    if (['shipped', 'delivered'].includes(newStatus)) {
      await sendSellerNotification({
        userId: order.buyer,
        type: 'order_update',
        message: `Your order #${order.shortId} has been ${newStatus}`,
        metadata: { orderId }
      });
    }

    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const bulkUpdateOrders = async (sellerId, updates) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: {
          _id: update.orderId,
          'items.seller': sellerId,
          status: { $in: statusTransitions[update.fromStatus] || [] }
        },
        update: {
          $set: { status: update.toStatus },
          $push: {
            statusHistory: {
              status: update.toStatus,
              changedBy: sellerId,
              timestamp: new Date()
            }
          }
        }
      }
    }));

    const result = await Order.bulkWrite(bulkOps, { session });

    // Update store metrics for delivered/cancelled orders
    const deliveredOrders = updates.filter(u => u.toStatus === 'delivered');
    const cancelledOrders = updates.filter(u => u.toStatus === 'cancelled');

    if (deliveredOrders.length > 0 || cancelledOrders.length > 0) {
      const orderIds = [...deliveredOrders, ...cancelledOrders].map(u => u.orderId);
      const orders = await Order.find({ _id: { $in: orderIds } }).session(session);
      
      let totalSalesChange = 0;
      const ordersToAdd = [];
      const ordersToRemove = [];

      orders.forEach(order => {
        const update = updates.find(u => u.orderId.toString() === order._id.toString());
        if (update.toStatus === 'delivered') {
          totalSalesChange += order.totalAmount;
          // Add order items to store
          const orderItems = order.items.filter(item => item.seller.toString() === sellerId);
          orderItems.forEach(item => {
            ordersToAdd.push({
              buyer: order.buyer,
              product: item.product,
              quantity: item.quantity,
              order: order._id,
              amount: item.price * item.quantity
            });
          });
        } else if (update.toStatus === 'cancelled') {
          totalSalesChange -= order.totalAmount;
          ordersToRemove.push(order._id);
        }
      });

      if (totalSalesChange !== 0 || ordersToAdd.length > 0 || ordersToRemove.length > 0) {
        const storeUpdate = { $inc: { 'metrics.totalSales': totalSalesChange } };
        
        if (ordersToAdd.length > 0) {
          storeUpdate.$push = { orders: { $each: ordersToAdd } };
        }
        
        if (ordersToRemove.length > 0) {
          storeUpdate.$pull = { orders: { order: { $in: ordersToRemove } } };
        }

        await Store.updateOne(
          { seller: sellerId },
          storeUpdate,
          { session }
        );
      }
    }

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getOrderAnalytics = async (sellerId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return Order.aggregate([
    { $match: { 
      'items.seller': new mongoose.Types.ObjectId(sellerId),
      createdAt: { $gte: thirtyDaysAgo }
    }},
    { $unwind: '$items' },
    { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) }},
    { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$items.price' },
        avgOrderValue: { $avg: '$totalAmount' },
        byStatus: {
          $push: {
            status: '$status',
            amount: '$totalAmount'
          }
        }
      }
    },
    { $project: {
        _id: 0,
        totalOrders: 1,
        totalRevenue: 1,
        avgOrderValue: 1,
        statusDistribution: {
          $arrayToObject: {
            $map: {
              input: '$byStatus',
              as: 'item',
              in: {
                k: '$$item.status',
                v: {
                  count: { $sum: 1 },
                  revenue: { $sum: '$$item.amount' }
                }
              }
            }
          }
        }
      }
    }
  ]);
};

module.exports = {
getSellerOrders,
updateOrderStatus,
bulkUpdateOrders,
getOrderAnalytics
}
