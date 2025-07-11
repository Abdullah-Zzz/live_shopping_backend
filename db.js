const mongoose = require("mongoose");
require("dotenv").config()
const DB_URL = process.env.DB_URL

mongoose.connect(DB_URL).then((res)=>{
    console.log("connected");
}).catch(err => console.log(err))
