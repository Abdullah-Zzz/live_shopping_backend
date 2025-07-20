const Store = require("../models/vendor_store");
const liveSessionModel = require("../models/live_session");
const User = require("../models/user_schema");


// Follow a store
const followStore = async (req, res) => {
    try {
        const userId = req.user.id;
        const { storeId } = req.body;
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, message: "Store not found" });
        }
        if (store.followers.includes(userId)) {
            return res.status(400).json({ success: false, message: "Already following this store" });
        }
        store.followers.push(userId);
        store.followerCount = store.followers.length;
        await store.save();
        return res.status(200).json({ success: true, message: "Store followed", followerCount: store.followerCount });
    } catch (err) {
        console.error("Follow Store Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Unfollow a store
const unfollowStore = async (req, res) => {
    try {
        const userId = req.user.id;
        const { storeId } = req.body;
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, message: "Store not found" });
        }
        if (!store.followers.includes(userId)) {
            return res.status(400).json({ success: false, message: "You are not following this store" });
        }
        store.followers = store.followers.filter(f => f.toString() !== userId);
        store.followerCount = store.followers.length;
        await store.save();
        return res.status(200).json({ success: true, message: "Store unfollowed", followerCount: store.followerCount });
    } catch (err) {
        console.error("Unfollow Store Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Enhanced getStore to include followers, followerCount, and live sessions
const getStore = async (req, res) => {
    try {
        const id = req.user.id;
        const store = await Store.findOne({ seller: id })
            .populate("followers", "name avatar email")
            .lean();
        if (!store) {
            return res.status(404).json({
                success: true,
                message: "No Store found, please make sure you are vrified by the admin"
            });
        }
        // Get live sessions for this store
        const liveSessions = await liveSessionModel.find({ store: store._id, status: { $in: ["live", "scheduled"] } })
            .select("title status startTime endTime zegoRoomId")
            .lean();
        store.liveSessions = liveSessions;
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
const updateStore = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      storeName,
      description,
      address,
      contact,
      socialMedia,
      media,
    } = req.body;

    if (!storeName || !description || !address) {
      return res.status(400).json({
        success: false,
        message: "Store name, description, and address are required.",
      });
    }

    const store = await Store.findOne({ seller: userId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found for this seller.",
      });
    }

    store.storeName = storeName;
    store.description = description;
    store.address = address;

    if (contact) {
      store.contact = {
        phone: contact.phone || store.contact.phone,
        email: contact.email || store.contact.email,
      };
    }

    if (socialMedia) {
      store.socialMedia = {
        instagram: socialMedia.instagram || store.socialMedia.instagram,
        facebook: socialMedia.facebook || store.socialMedia.facebook,
        twitter: socialMedia.twitter || store.socialMedia.twitter,
      };
    }

    if (media) {
      store.media = {
        logo: media.logo || store.media.logo,
        banner: media.banner || store.media.banner,
      };
    }

    await store.save();

    return res.status(200).json({
      success: true,
      message: "Store updated successfully.",
      store,
    });
  } catch (err) {
    console.error("Update Store Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = { getStore, followStore, unfollowStore,updateStore };