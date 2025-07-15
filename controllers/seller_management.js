const Order = require('../models/order_schema');

const getSellerOrders = async (sellerId, filters = {}) => {
  const {
    status,
    dateFrom,
    dateTo,
    minAmount,
    search,
    page = 1,
    limit = 20,
    sort = '-createdAt'
  } = filters;

  const matchStage = {
    'items.seller': new mongoose.Types.ObjectId(sellerId),
    ...(status && { status }),
    ...(dateFrom && { createdAt: { $gte: new Date(dateFrom) } }),
    ...(dateTo && { createdAt: { $lte: new Date(dateTo) } }),
    ...(minAmount && { totalAmount: { $gte: Number(minAmount) } })
  };

  if (search) {
    matchStage.$or = [
      { 'buyer.name': { $regex: search, $options: 'i' } },
      { 'items.name': { $regex: search, $options: 'i' } },
      { transactionId: { $regex: search, $options: 'i' } }
    ];
  }

  const pipeline = [
    { $match: matchStage },
    { $unwind: '$items' },
    { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) } },
    { $group: {
        _id: '$_id',
        root: { $mergeObjects: '$$ROOT' },
        sellerItems: { $push: '$items' }
      }
    },
    { $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            '$root',
            { items: '$sellerItems' }
          ]
        }
      }
    },
    { $sort: sort === 'newest' ? { createdAt: -1 } : { createdAt: 1 } },
    { $facet: {
        metadata: [ { $count: "total" } ],
        data: [ 
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: {
              buyer: 1,
              items: 1,
              status: 1,
              totalAmount: 1,
              paymentStatus: '$payment.status',
              createdAt: 1,
              requiresAttention: '$flags.requiresAttention'
            }
          }
        ]
      }
    }
  ];

  const result = await Order.aggregate(pipeline);
  return {
    data: result[0].data,
    pagination: {
      total: result[0].metadata[0]?.total || 0,
      page,
      limit,
      totalPages: Math.ceil((result[0].metadata[0]?.total || 0) / limit)
    }
  };
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

    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      changedBy: sellerId,
      notes,
      timestamp: new Date()
    });

    await order.save({ session });
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

  return Order.bulkWrite(bulkOps);
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