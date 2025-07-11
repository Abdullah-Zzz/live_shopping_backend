const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat_controller");
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")
const { body, param, validationResult } = require("express-validator");

const validateStartOrGetChat = [
  body("sellerId").isMongoId().withMessage("Invalid sellerId"),
  body("productId").isMongoId().withMessage("Invalid productId"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateGetMessages = [
  param("chatId").isMongoId().withMessage("Invalid chatId"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

router.post("/start", auth,isBuyer, validateStartOrGetChat, chatController.startOrGetChat);
router.get("/:chatId/messages", auth,isBuyer, validateGetMessages, chatController.getMessages);

module.exports = router;