const User = require("../models/user_schema");
const Store = require("../models/vendor_store");
const Order = require("../models/order_schema");
const Product = require("../models/product_schema");
const Joi = require("joi");

// Get all sellers with optional filters
const getSellers = async (req, res) => {
    try {
        const schema = Joi.object({
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(10),
            verified: Joi.boolean(),
            active: Joi.boolean(),
            search: Joi.string().allow(""),
            sortBy: Joi.string().valid("createdAt", "name", "totalSales").default("createdAt"),
            order: Joi.string().valid("asc", "desc").default("desc")
        });

        const { error, value } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { page, limit, verified, active, search, sortBy, order } = value;
        const filter = { role: "seller" };

        if (typeof verified !== "undefined") filter.isSellerVerified = verified;
        if (typeof active !== "undefined") filter.isActive = active;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { "sellerInfo.shopName": { $regex: search, $options: "i" } }
            ];
        }

        let sortOption = { [sortBy]: order === "asc" ? 1 : -1 };
        if (sortBy === "totalSales") {
            sortOption = { "sellerInfo.totalSales": order === "asc" ? 1 : -1 };
        }

        const [sellers, total] = await Promise.all([
            User.find(filter)
                .sort(sortOption)
                .skip((page - 1) * limit)
                .limit(limit)
                .select("-password -resetPasswordToken -resetPasswordExpire")
                .populate({
                    path: "store",
                    select: "metrics.totalSales verificationStatus"
                }),
            User.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            sellers
        });

    } catch (err) {
        console.error("Get Sellers Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Verify a seller
const verifySeller = async (req, res) => {
    try {
        const schema = Joi.object({
            sellerId: Joi.string().required(),
            approve: Joi.boolean().required(),
            notes: Joi.string().allow("")
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { sellerId, approve, notes } = value;

        const seller = await User.findById(sellerId);
        if (!seller || seller.role !== "seller") {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        if (seller.isSellerVerified === approve) {
            return res.status(400).json({
                success: false,
                message: `Seller is already ${approve ? "verified" : "unverified"}`
            });
        }

        seller.isSellerVerified = approve;

        if (approve) {
            // Create store if approving
            const storeData = {
                seller: sellerId,
                storeName: seller.sellerInfo.shopName,
                description: seller.sellerInfo.description,
                contact: {
                    email: seller.email,
                    phone: seller.phone,
                    whatsapp: seller.sellerInfo.contact?.whatsapp
                },
                address: seller.sellerInfo.address,
                media: {
                    logo: seller.sellerInfo.logo || undefined
                },
                socialMedia: seller.sellerInfo.socialMedia || undefined,
                businessInfo: {
                    bankDetails: seller.sellerInfo.paymentInfo ? {
                        accountName: seller.sellerInfo.paymentInfo.accountName,
                        accountNumber: seller.sellerInfo.paymentInfo.accountNumber,
                        bankName: seller.sellerInfo.paymentInfo.bankName
                    } : undefined
                },
                verificationStatus: "verified",
                verificationNotes: notes
            };

            await Store.create(storeData);
        } else {
            // Deactivate store if rejecting
            await Store.updateOne(
                { seller: sellerId },
                {
                    verificationStatus: "rejected",
                    verificationNotes: notes,
                    settings: { isActive: false }
                }
            );
        }

        await seller.save();

        return res.status(200).json({
            success: true,
            message: `Seller ${approve ? "verified" : "unverified"} successfully`
        });

    } catch (err) {
        console.error("Verify Seller Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Manage seller account status (activate/deactivate)
const manageSellerStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            sellerId: Joi.string().required(),
            activate: Joi.boolean().required(),
            reason: Joi.string().allow("")
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { sellerId, activate, reason } = value;

        const seller = await User.findById(sellerId);
        if (!seller || seller.role !== "seller") {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        if (seller.isActive === activate) {
            return res.status(400).json({
                success: false,
                message: `Seller is already ${activate ? "active" : "inactive"}`
            });
        }

        seller.isActive = activate;
        await seller.save();

        // Update store status
        await Store.updateOne(
            { seller: sellerId },
            {
                "settings.isActive": activate,
                $push: {
                    statusHistory: {
                        status: activate ? "activated" : "deactivated",
                        changedAt: new Date(),
                        changedBy: req.user.id,
                        reason
                    }
                }
            }
        );

        // Deactivate all products if deactivating seller
        if (!activate) {
            await Product.updateMany(
                { seller: sellerId },
                { isActive: false }
            );
        }

        return res.status(200).json({
            success: true,
            message: `Seller account ${activate ? "activated" : "deactivated"} successfully`
        });

    } catch (err) {
        console.error("Manage Seller Status Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get all stores with optional filters
const getStores = async (req, res) => {
    try {
        const schema = Joi.object({
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(10),
            verified: Joi.boolean(),
            active: Joi.boolean(),
            search: Joi.string().allow(""),
            sortBy: Joi.string().valid("createdAt", "storeName", "metrics.totalSales").default("createdAt"),
            order: Joi.string().valid("asc", "desc").default("desc")
        });

        const { error, value } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { page, limit, verified, active, search, sortBy, order } = value;
        const filter = {};

        if (typeof verified !== "undefined") {
            filter.verificationStatus = verified ? "verified" : { $ne: "verified" };
        }
        if (typeof active !== "undefined") filter["settings.isActive"] = active;
        if (search) {
            filter.$or = [
                { storeName: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { "contact.email": { $regex: search, $options: "i" } }
            ];
        }

        const sortOption = { [sortBy]: order === "asc" ? 1 : -1 };

        const [stores, total] = await Promise.all([
            Store.find(filter)
                .sort(sortOption)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("seller", "name email phone"),
            Store.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            stores
        });

    } catch (err) {
        console.error("Get Stores Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Verify a store
const verifyStore = async (req, res) => {
    try {
        const schema = Joi.object({
            storeId: Joi.string().required(),
            approve: Joi.boolean().required(),
            notes: Joi.string().allow("")
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { storeId, approve, notes } = value;

        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found"
            });
        }

        if (store.verificationStatus === (approve ? "verified" : "rejected")) {
            return res.status(400).json({
                success: false,
                message: `Store is already ${approve ? "verified" : "rejected"}`
            });
        }

        store.verificationStatus = approve ? "verified" : "rejected";
        store.verificationNotes = notes;
        await store.save();

        // Update seller verification status if approving
        if (approve) {
            await User.findByIdAndUpdate(store.seller, {
                isSellerVerified: true
            });
        }

        return res.status(200).json({
            success: true,
            message: `Store ${approve ? "verified" : "rejected"} successfully`
        });

    } catch (err) {
        console.error("Verify Store Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Manage store status (activate/deactivate)
const manageStoreStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            storeId: Joi.string().required(),
            activate: Joi.boolean().required(),
            reason: Joi.string().allow("")
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { storeId, activate, reason } = value;

        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found"
            });
        }

        if (store.settings.isActive === activate) {
            return res.status(400).json({
                success: false,
                message: `Store is already ${activate ? "active" : "inactive"}`
            });
        }

        store.settings.isActive = activate;
        await store.save();

        // Deactivate all products if deactivating store
        if (!activate) {
            await Product.updateMany(
                { store: storeId },
                { isActive: false }
            );
        }

        return res.status(200).json({
            success: true,
            message: `Store ${activate ? "activated" : "deactivated"} successfully`
        });

    } catch (err) {
        console.error("Manage Store Status Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get store details
const getStoreDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const store = await Store.findById(id)
            .populate("seller", "name email phone avatar")
            .populate("products", "name price images ratings")
            .populate("orders", "totalAmount status");

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found"
            });
        }

        return res.status(200).json({
            success: true,
            store
        });

    } catch (err) {
        console.error("Get Store Details Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
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

    // Admin cancel order
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
// Admin dashboard stats
const getAdminDashboardStats = async (req, res) => {
    try {
        const [
            totalSellers,
            activeSellers,
            verifiedSellers,
            totalStores,
            activeStores,
            verifiedStores,
            totalProducts,
            activeProducts,
            totalOrders,
            pendingOrders,
            completedOrders,
            totalRevenue
        ] = await Promise.all([
            User.countDocuments({ role: "seller" }),
            User.countDocuments({ role: "seller", isActive: true }),
            User.countDocuments({ role: "seller", isSellerVerified: true }),
            Store.countDocuments(),
            Store.countDocuments({ "settings.isActive": true }),
            Store.countDocuments({ verificationStatus: "verified" }),
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Order.countDocuments(),
            Order.countDocuments({ status: { $in: ["pending", "processing"] } }),
            Order.countDocuments({ status: "delivered" }),
            Order.aggregate([
                { $match: { status: "delivered" } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ])
        ]);

        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("buyer", "name")
            .populate("items.seller", "name");

        const recentSellers = await User.find({ role: "seller" })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("name email createdAt");

        return res.status(200).json({
            success: true,
            stats: {
                sellers: {
                    total: totalSellers,
                    active: activeSellers,
                    verified: verifiedSellers
                },
                stores: {
                    total: totalStores,
                    active: activeStores,
                    verified: verifiedStores
                },
                products: {
                    total: totalProducts,
                    active: activeProducts
                },
                orders: {
                    total: totalOrders,
                    pending: pendingOrders,
                    completed: completedOrders,
                    revenue: totalRevenue[0]?.total || 0
                }
            },
            recent: {
                orders: recentOrders,
                sellers: recentSellers
            }
        });

    } catch (err) {
        console.error("Get Admin Dashboard Stats Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }


    
};

module.exports = {
    getSellers,
    verifySeller,
    manageSellerStatus,
    getStores,
    verifyStore,
    manageStoreStatus,
    getStoreDetails,
    getAdminDashboardStats,
    getAllOrders,
    adminCancelOrder
};