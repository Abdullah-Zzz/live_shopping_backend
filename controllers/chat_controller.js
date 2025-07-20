const Chat = require("../models/chat_schema");
const Joi = require("joi");

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
  const chat = await Chat.findById(chatId).populate("messages.sender", "name avatar");
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ messages: chat.messages });
};

// Send a message (text, image, or system)
exports.sendMessage = async (req, res) => {
  const schema = Joi.object({
    chatId: Joi.string().required(),
    text: Joi.string().allow(""),
    type: Joi.string().valid("text", "image", "system").default("text"),
    imageUrl: Joi.string().uri().optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { chatId, text, type, imageUrl } = value;
  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  let messageContent = text;
  if (type === "image" && imageUrl) {
    messageContent = imageUrl;
  }

  const message = {
    sender: req.user.id,
    text: messageContent,
    type: type || "text",
    createdAt: new Date()
  };
  chat.messages.push(message);
  await chat.save();
  res.status(201).json({ success: true, message });
};