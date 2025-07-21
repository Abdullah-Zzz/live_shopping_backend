// routes/attributeRoutes.js
const express = require("express");
const router = express.Router();
const attributeController = require("../controllers/attributeController");
const {auth,isSeller,isAdmin,isBuyer} = require("../middleware/auth")


router.get("/",auth, isSeller, attributeController.getAllAttributes);
router.post("/",auth, isSeller, attributeController.createAttribute);
router.put("/:id",auth, isSeller, attributeController.updateAttribute);
router.delete("/:id",auth, isSeller, attributeController.deleteAttribute);

module.exports = router;
