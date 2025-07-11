const Chat = require("../models/chat_schema");
exports.startOrGetChat = async (req, res) => {
  const buyerId = req.user.id;
  const { sellerId, productId } = req.body;

  let chat = await Chat.findOne({ buyer: buyerId, seller: sellerId, product: productId });
  if (!chat) {
    chat = new Chat({ buyer: buyerId, seller: sellerId, product: productId, messages: [] });
    await chat.save();
  }
  res.json({ chatId: chat._id });
};

exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  const chat = await Chat.findById(chatId).populate("messages.sender", "name");
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ messages: chat.messages });
};