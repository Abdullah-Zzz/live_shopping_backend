const user_schema = require("../models/user_schema");
const register_token_schema = require("../models/register_token");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const reset_token = require("../models/reset_token");
require("dotenv").config();

const EMAIL = process.env.EMAIL;
const PASS = process.env.PASS;
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
const JWT_SECRET = process.env.JWT_SECRET
const CLIENT_URL = process.env.CLIENT_URL;

const register_user = async (req, res) => {
  try {
    const { name, email, password, role, phone, shopName, description,address } = req.body;

    const schema = Joi.object({
      name: Joi.string().min(3).max(30).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
      password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()])/).required(),
      role: Joi.string().valid("buyer", "seller").required(),
      shopName: Joi.string().when("role", { is: "seller", then: Joi.required() }),
      description: Joi.string().when("role", { is: "seller", then: Joi.required() })
    });

    const { error } = schema.validate({ name, email, phone, password, role, shopName, description });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const userExists = await user_schema.findOne({ email });
    if (userExists) return res.status(400).json({ message: "Email already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      isProfileComplete: true,
    };

    if (role === "seller") {
      userData.sellerInfo = {
        shopName,
        description
      };
    }

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "30m" });
    await register_token_schema.create({ token })

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL, pass: PASS }
    });

    const mailOptions = {
      from: EMAIL,
      to: email,
      subject: "Verify Your Account",
      html: `
        <p>Hello ${name},</p>
        <p>Click the link below to verify and complete your registration:</p>
        <a href="${CLIENT_URL}/register/link/${token}">${CLIENT_URL}/register/link/${token}</a>
        <p>This link expires in 30 minutes.</p>
      `
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Mail Error:", err);
        return res.status(500).json({ message: "Failed to send verification email." });
      }
      return res.status(200).json({ message: "Verification email sent. Check your inbox." });
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Server error. Try again later." });
  }
};

const verify_user = async (req, res) => {
  try {
    const { token } = req.params;
    let decode;

    const storedToken = await register_token_schema.findOne({ token });
    if (!storedToken) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    try {
      decode = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token has expired." });
      }
      return res.status(400).json({ message: "Invalid token." });
    }

    const existingUser = await user_schema.findOne({ email: decode.email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const user = new user_schema(decode);
    await user.save();

    await register_token_schema.deleteOne({ token });

    res.status(200).json({ message: "Registration complete. You can now log in." });

  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ message: "Something went wrong during verification." });
  }
};

const login_user = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await user_schema.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "Email not found." });

    if(password ==="googleOauth"){
      return res.status(401).json({ message: "Please use Google sign in." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

    const refresh_token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    const access_token = jwt.sign({ id: user._id, email: user.email, role: user.role },JWT_ACCESS_SECRET,{expiresIn : "15min"}) 

    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.cookie("access_token",access_token,{
      httpOnly : true,
      secure : process.env.NODE_ENV === "production",
      sameSite : "strict",
      maxAge : 15 * 60 * 1000

    })

    res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error. Try again later." });
  }
};

const user_dashboard = async (req, res) => {
  try {
    const { email } = req.user;
    const user = await user_schema.findOne({ email }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    res.status(200).json({ user });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
const logout = async (req, res) => {
  try {
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "strict"
    });
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "strict"
    });

    res.status(200).json({ message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
const forgot_password_link = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await user_schema.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30m" });
    await reset_token.create({token})

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL,
        pass: PASS,
      },
    });

    const mailOptions = {
      from: EMAIL,
      to: email,
      subject: "Reset Your Password",
      html: `
        <p>Hello ${user.name},</p>
        <p>Click the link below to reset your password:</p>
        <a href="${CLIENT_URL}/reset-password/${token}">${CLIENT_URL}/reset-password/${token}</a>
        <p>This link expires in 30 minutes.</p>
      `,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Mail Error:", err);
        return res.status(500).json({ message: "Failed to send reset email." });
      }

      return res.status(200).json({ message: "Reset email sent. Check your inbox." });
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

const change_password = async (req, res) => {
  const { token } = req.params;
  const { password, confirm_password } = req.body;

  if (password != confirm_password) {
    return res.status(400).json({ message: "Passwords do not match." });
  }

  const tokenDoc = await reset_token.findOne({ token });
  if (!tokenDoc) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired." });
    }
    return res.status(400).json({ message: "Invalid token." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await user_schema.findOneAndUpdate(
    { email: decoded.email },
    { $set: { password: hashedPassword } },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  await reset_token.deleteOne({ token });

  return res.status(200).json({ message: "Password updated successfully." });
};

const refresh_access_token = async (req,res)=>{
  try{
    const refresh_token = req.cookies.refresh_token
    if(!refresh_token) return res.status(401).json({ message: "No refresh token" });
    try{
      let decoded = jwt.verify(refresh_token,JWT_REFRESH_SECRET);
      let data = {
        id : decoded.id,
        email : decoded.email,
        role : decoded.role
      }
      const new_access_token = jwt.sign(data,JWT_ACCESS_SECRET,{expiresIn : "15min"})
      res.cookie("access_token",new_access_token,{
      httpOnly : true,
      secure : process.env.NODE_ENV === "production",
      sameSite : "strict",
      maxAge : 15 * 60 * 1000

    })
    res.status(200).json({message : "Token refreshed"})
    }
    catch(err){
      return res.status(403).json({ message: "Invalid refresh token "+err });
    }
  }
  catch(err){
    res.status(500).json({ message: "Server error." });
  }
}
const complete_profile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { role, phone, shopName, description, address } = req.body;
    const user = await user_schema.findById(userId);
    if (user.isProfileComplete) {
      return res.status(400).json({ message: "Profile already completed." });
    }
    const schema = Joi.object({
      role: Joi.string().valid("buyer", "seller").required(),
      phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
      shopName: Joi.when("role", {
        is: "seller",
        then: Joi.string().min(2).max(50).required(), 
        otherwise: Joi.forbidden()
      }),
      description: Joi.when("role", {
        is: "seller",
        then: Joi.string().min(2).max(200).required(),
        otherwise: Joi.forbidden()
      }),
      address: Joi.when("role", {
        is: "seller",
        then: Joi.string().min(2).max(200).required(),
        otherwise: Joi.forbidden()
      }),
    });

    const { error } = schema.validate({ role, phone, shopName, description, address });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const updateData = { role, phone, isProfileComplete: true };
    if (role === "seller") {
      updateData.sellerInfo = { shopName, description, address };
    } else {
      updateData.sellerInfo = undefined; 
    }

    const updatedUser = await user_schema.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "User not found." });

    res.status(200).json({ message: "Profile completed.", user: updatedUser });
  } catch (err) {
    console.error("Complete Profile Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
const edit_profile_buyer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
    });
    const { error } = schema.validate({ name });
    if (error) return res.status(400).json({ message: error.details[0].message });
    const updatedUser = await user_schema.findByIdAndUpdate(
      userId,
      { name },
      { new: true }
    ).select("-password");
    if (!updatedUser) return res.status(404).json({ message: "User not found." });
    res.status(200).json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (err) {
    console.error("Edit Profile Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
const edit_profile_seller = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, shopName, description, address } = req.body;
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
      shopName: Joi.string().min(2).max(50).required(),
      description: Joi.string().min(2).max(200).required(),
      address: Joi.string().min(2).max(200).required(), 
    });
    const { error } = schema.validate({ name, shopName, description, address });
    if (error) return res.status(400).json({ message: error.details[0].message });
    const updatedUser = await user_schema.findByIdAndUpdate(
      userId,
      {
        name,
        sellerInfo: {
          shopName,
          description,
          address
        },
        isProfileComplete: true
      },
      { new: true }
    ).select("-password");
    if (!updatedUser) return res.status(404).json({ message: "User not  found." });
    res.status(200).json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (err) {
    console.error("Edit Profile Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
const change_phone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone } = req.body;

    const schema = Joi.object({
      phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
    });

    const { error } = schema.validate({ phone });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const updatedUser = await user_schema.findByIdAndUpdate(
      userId,
      { phone },
      { new: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ message: "User not found." });

    res.status(200).json({ message: "Phone number updated successfully.", user: updatedUser });
  } catch (err) {
    console.error("Change Phone Error:", err);
    res.status(500).json({ message: "Server error." });
  }
} 
module.exports = {
  register_user,
  verify_user,
  login_user,
  user_dashboard,
  logout,
  forgot_password_link,
  change_password,
  refresh_access_token,
  complete_profile,
  change_phone,
  edit_profile_seller,
  edit_profile_buyer
};
