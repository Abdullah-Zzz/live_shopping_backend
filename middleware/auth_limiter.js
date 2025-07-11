const rateLimit = require("express-rate-limit");

const auth_limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: "Too many login attempts. Please try again later."
});

module.exports = {
  auth_limiter          
};
