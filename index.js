const express = require("express")
const user_route = require("./routes/user_routes")
const DB  = require("./db")
const http = require("http");
const cors = require("cors");
require("dotenv").config()
const cookie_parser = require("cookie-parser")
const PORT = process.env.PORT
const helmet = require("helmet");
const xssClean = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize")
const product_route = require("./routes/prod_routes")
const cart_route = require("./routes/cart_routes")
const google_auth_routes = require("./routes/google_route")
const order_routes = require("./routes/order_routes")
const stream_routes = require("./routes/stream_routes")
const chatRoutes = require("./routes/chat_routes");
const pay_routes = require("./routes/payU_routes")
const seller_management_routes = require("./routes/seller_management_routes")
const admin_routes = require("./routes/admin_routes")
const store_routes = require("./routes/store_routes")
const attribute_routes = require("./routes/attributeRoutes")
const app = express()
const otp_routes = require("./routes/otp_routes")
const allowedOrigins = process.env.CLIENT_URL
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: { origin: allowedOrigins,credentials: true } 
});

app.use(express.json());
app.use(cookie_parser())
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}))
app.use(express.urlencoded({ extended: true }));

app.use("/api/users",user_route)
app.use("/api/products",product_route)
app.use("/api/cart",cart_route)
app.use("/auth",google_auth_routes)
app.use("/api/orders",order_routes)
app.use("/api/stream",stream_routes)
app.use("/api/chat", chatRoutes);
app.use("/api/payu", pay_routes);
app.use("/api",otp_routes)
app.use("/api",seller_management_routes)
app.use("/api/admin",admin_routes)
app.use("/api/store",store_routes)
app.use("/api/attribute",attribute_routes)



require("./socket/chat")(io);

server.listen(PORT,()=>{
    console.log("server started : http://localhost:8080")
})