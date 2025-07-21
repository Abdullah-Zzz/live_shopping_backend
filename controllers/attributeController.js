const Attribute = require("../models/attribute");

// GET /api/attribute
exports.getAllAttributes = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const attributes = await Attribute.find({ sellerId });
    res.status(200).json({ success: true, data: attributes });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// POST /api/attribute
exports.createAttribute = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { name, colors, sizes } = req.body;

    const attribute = await Attribute.create({ sellerId, name, colors, sizes });
    res.status(201).json({ success: true, data: attribute });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/attribute/:id
exports.updateAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    const updated = await Attribute.findOneAndUpdate(
      { _id: id, sellerId },
      req.body,
      { new: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/attribute/:id
exports.deleteAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    await Attribute.findOneAndDelete({ _id: id, sellerId });
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
