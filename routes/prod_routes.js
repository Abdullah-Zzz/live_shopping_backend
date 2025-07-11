const express = require("express")
const router = express.Router()
const {retrieve_products,add_product,edit_product,delete_product,sellers_products,get_product_by_id,get_seller_products} = require("../controllers/product_controllers") 
const {auth,isSeller,isAdmin} = require("../middleware/auth")

router.get("/get",retrieve_products)
router.post("/add",auth,isSeller,add_product)
router.delete("/delete/:id",auth,isSeller,delete_product)
router.put("/edit/:id",auth,isSeller,edit_product)
router.get("/my-products",auth,isSeller,sellers_products)
router.get("/:id",auth,get_product_by_id)
router.get("/seller/:sellerId",auth,get_seller_products)

module.exports = router