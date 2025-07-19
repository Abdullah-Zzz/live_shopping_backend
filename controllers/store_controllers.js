const Store = require("../models/vendor_store");


const getStore = async (req, res) => {
    try {
        const id = req.user.id
        const store = await Store.find({seller: id})
        if (!store) {
            return res.status(404).json({
                success: true,
                message: "No Store found, please make sure you are vrified by the admin"
            });
        }

        return res.status(200).json({
            success: true,
            store
        });

    } catch (err) {
        console.error("Get Store Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = { getStore }