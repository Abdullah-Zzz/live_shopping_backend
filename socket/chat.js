const Chat = require("../models/chat_schema");

module.exports = function(io) {
  io.on("connection", (socket) => {
    socket.on("joinChat", ({ chatId }) => {
      socket.join(`chat_${chatId}`);
      socket.emit("joinedChat", { chatId, message: "Joined chat room successfully." });
    });

    socket.on("sendMessage", async ({ chatId, senderId, text }) => {
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      if(chat.buyer.toString() !== senderId && chat.seller.toString() !== senderId) {
        return socket.emit("error", { message: "You are not part of this chat." });
      }
      chat.messages.push({ sender: senderId, text });
      await chat.save();

      io.to(`chat_${chatId}`).emit("newMessage", {
        chatId,
        senderId,
        text,
        createdAt: new Date()
      });
    });
  });
};