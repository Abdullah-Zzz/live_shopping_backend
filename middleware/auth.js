const jwt = require("jsonwebtoken");
require("dotenv").config()
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET


const auth = (req, res, next) => {
    const token = req.cookies.access_token
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie("token")
        return res.status(401).json({ message: "Invalid or expired token" });
    }

}
const isSeller = (req, res, next) => {
  if (req.user.role !== 'seller') return res.status(403).json({ message: 'Only sellers allowed' });
  next();
};
const isAdmin = (req,res,next)=>{
    if(req.user.role != "admin") return res.status(403).json({message : "Only Admins"});
    next();
}
const isBuyer = (req,res,next)=>{
    if(req.user.role != "buyer") return res.status(403).json({message : "Only buyers"});
    next();
}

module.exports = {
    auth,
    isSeller,
    isAdmin,
    isBuyer
}
