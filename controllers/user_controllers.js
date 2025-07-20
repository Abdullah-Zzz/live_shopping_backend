const User = require("../models/user_schema");
const RegisterToken = require("../models/register_token");
const ResetToken = require("../models/reset_token");
const Store = require("../models/vendor_store");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
require("dotenv").config();

const {
  EMAIL,
  PASS,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
  CLIENT_URL
} = process.env;

// Helper function for sending emails
const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL, pass: PASS }
  });

  const mailOptions = { from: EMAIL, to, subject, html };
  await transporter.sendMail(mailOptions);
};

// Register a new user
const registerUser = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(3).max(30).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^[+]?\d{10,15}$/).required(),
      password: Joi.string().min(8)
        .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()])/)
        .required(),
      role: Joi.string().valid("buyer", "seller").required(),
      shopName: Joi.string().when("role", { 
        is: "seller", 
        then: Joi.string().min(2).max(50).required() 
      }),
      description: Joi.string().when("role", { 
        is: "seller", 
        then: Joi.string().min(10).max(200).required() 
      }),
      address: Joi.string().when("role", { 
        is: "seller", 
        then: Joi.string().min(5).max(200).required() 
      }),
      bio: Joi.string().max(200).optional(),
      dateOfBirth: Joi.date().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { name, email, password, role, phone, shopName, description, address, bio, dateOfBirth } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ 
        success: false,
        message: "Email already registered" 
      });
    }
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      isProfileComplete: role === "buyer", // Sellers need to complete profile
      emailVerified: false,
      phoneVerified: false,
      blocked: false,
      bio: bio || "",
      dateOfBirth: dateOfBirth || undefined
    };

    if (role === "seller") {
      userData.sellerInfo = {
        shopName,
        description,
        address
      };
    }

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "30m" });
    await RegisterToken.create({ token });

    const verificationLink = `${CLIENT_URL}/verify-email/${token}`;
    const emailHtml = `
      <p>Hello ${name},</p>
      <p>Please click the link below to verify your email:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>This link expires in 30 minutes.</p>
    `;

    await sendEmail(email, "Verify Your Email", emailHtml);

    return res.status(200).json({ 
      success: true,
      message: "Verification email sent. Please check your inbox." 
    });

  } catch (err) {
    console.error("Registration Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Verify user email
const verifyUser = async (req, res) => {
  try {
    const { token } = req.params;

    const storedToken = await RegisterToken.findOne({ token });
    if (!storedToken) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ 
          success: false,
          message: "Token has expired" 
        });
      }
      return res.status(400).json({ 
        success: false,
        message: "Invalid token" 
      });
    }

    const existingUser = await User.findOne({ email: decoded.email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: "Email already registered" 
      });
    }

    const user = new User(decoded);
    user.emailVerified = true;
    await user.save();
    await RegisterToken.deleteOne({ token });

    return res.status(201).json({ 
      success: true,
      message: "Registration complete. You can now log in." 
    });

  } catch (err) {
    console.error("Verification Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// User login
const loginUser = async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    if (password === "googleOauth") {
      return res.status(401).json({ 
        success: false,
        message: "Please use Google sign-in" 
      });
    }
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false,
        message: "Account is deactivated" 
      });
    }

    if (user.blocked) {
      return res.status(403).json({ 
        success: false,
        message: "Account is blocked. Please contact support." 
      });
    }

    const refreshToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 15 * 60 * 1000
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isProfileComplete: user.isProfileComplete
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// User dashboard
const userDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password -resetPasswordToken -resetPasswordExpire");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      user 
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Logout user
const logout = async (req, res) => {
  try {
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None"
    });

    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None"
    });

    return res.status(200).json({ 
      success: true,
      message: "Logged out successfully" 
    });

  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Forgot password - send reset link
const forgotPassword = async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Email not found" 
      });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30m" });
    await ResetToken.create({ token });

    const resetLink = `${CLIENT_URL}/reset-password/${token}`;
    const emailHtml = `
      <p>Hello ${user.name},</p>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link expires in 30 minutes.</p>
    `;

    await sendEmail(email, "Reset Your Password", emailHtml);

    return res.status(200).json({ 
      success: true,
      message: "Password reset email sent" 
    });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const schema = Joi.object({
      password: Joi.string().min(8)
        .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()])/)
        .required(),
      confirmPassword: Joi.string().valid(Joi.ref("password")).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { token } = req.params;
    const { password } = req.body;

    const tokenDoc = await ResetToken.findOne({ token });
    if (!tokenDoc) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ 
          success: false,
          message: "Token has expired" 
        });
      }
      return res.status(400).json({ 
        success: false,
        message: "Invalid token" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.findOneAndUpdate(
      { email: decoded.email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    await ResetToken.deleteOne({ token });

    return res.status(200).json({ 
      success: true,
      message: "Password updated successfully" 
    });

  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Refresh access token
const refreshAccessToken = async (req, res) => {
  try {
    const { refresh_token } = req.cookies;
    if (!refresh_token) {
      return res.status(401).json({ 
        success: false,
        message: "No refresh token provided" 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid refresh token" 
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 15 * 60 * 1000
    });

    return res.status(200).json({ 
      success: true,
      message: "Access token refreshed" 
    });

  } catch (err) {
    console.error("Refresh Token Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Complete user profile
const completeProfile = async (req, res) => {
  try {
    const schema = Joi.object({
      role: Joi.string().valid("buyer", "seller").required(),
      phone: Joi.string().pattern(/^[+]?\d{10,15}$/).required(),
      shopName: Joi.when("role", {
        is: "seller",
        then: Joi.string().min(2).max(50).required(),
        otherwise: Joi.forbidden()
      }),
      description: Joi.when("role", {
        is: "seller",
        then: Joi.string().min(10).max(200).required(),
        otherwise: Joi.forbidden()
      }),
      address: Joi.when("role", {
        is: "seller",
        then: Joi.string().min(5).max(200).required(),
        otherwise: Joi.forbidden()
      }),
      bio: Joi.string().max(200).optional(),
      dateOfBirth: Joi.date().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const userId = req.user.id;
    const { role, phone, shopName, description, address, bio, dateOfBirth } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    if (user.isProfileComplete) {
      return res.status(400).json({ 
        success: false,
        message: "Profile already completed" 
      });
    }

    const updateData = { 
      role, 
      phone, 
      isProfileComplete: true,
      bio: bio || user.bio,
      dateOfBirth: dateOfBirth || user.dateOfBirth
    };

    if (role === "seller") {
      updateData.sellerInfo = { 
        shopName, 
        description, 
        address 
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      updateData, 
      { new: true }
    ).select("-password");

    return res.status(200).json({ 
      success: true,
      message: "Profile completed successfully",
      user: updatedUser
    });

  } catch (err) {
    console.error("Complete Profile Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Edit buyer profile
const editBuyerProfile = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
      phone: Joi.string().pattern(/^[+]?\d{10,15}$/).required(),
      bio: Joi.string().max(200).optional(),
      dateOfBirth: Joi.date().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const userId = req.user.id;
    const { name, phone, bio, dateOfBirth } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, bio: bio || "", dateOfBirth: dateOfBirth || undefined },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    console.error("Edit Buyer Profile Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Edit seller profile
const editSellerProfile = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
      phone: Joi.string().pattern(/^[+]?\d{10,15}$/).required(),
      shopName: Joi.string().min(2).max(50).required(),
      description: Joi.string().min(10).max(200).required(),
      address: Joi.string().min(5).max(200).required(),
      logo: Joi.string().uri().optional(),
      socialMedia: Joi.object({
        facebook: Joi.string().uri().optional(),
        instagram: Joi.string().uri().optional(),
        twitter: Joi.string().uri().optional(),
        youtube: Joi.string().uri().optional()
      }).optional(),
      paymentInfo: Joi.object({
        bankName: Joi.string().required(),
        accountNumber: Joi.string().required(),
        accountName: Joi.string().required(),
        taxId: Joi.string().optional()
      }).optional(),
      bio: Joi.string().max(200).optional(),
      dateOfBirth: Joi.date().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const userId = req.user.id;
    const { 
      name, 
      phone, 
      shopName, 
      description, 
      address,
      logo,
      socialMedia,
      paymentInfo,
      bio,
      dateOfBirth
    } = req.body;

    const updateData = {
      name,
      phone,
      bio: bio || "",
      dateOfBirth: dateOfBirth || undefined,
      sellerInfo: {
        shopName,
        description,
        address
      }
    };

    if (logo) {
      updateData.sellerInfo.logo = logo;
    }

    if (socialMedia) {
      updateData.sellerInfo.socialMedia = socialMedia;
    }

    if (paymentInfo) {
      updateData.sellerInfo.paymentInfo = paymentInfo;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Update store if exists
    const store = await Store.findOne({ seller: userId });
    if (store) {
      store.storeName = shopName;
      store.description = description;
      store.contact.phone = phone;
      
      if (logo) {
        store.media.logo = logo;
      }
      
      if (socialMedia) {
        store.socialMedia = socialMedia;
      }
      
      if (paymentInfo) {
        store.businessInfo.bankDetails = {
          accountName: paymentInfo.accountName,
          accountNumber: paymentInfo.accountNumber,
          bankName: paymentInfo.bankName
        };
      }
      
      await store.save();
    }

    return res.status(200).json({ 
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    console.error("Edit Seller Profile Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

// Change phone number
const changePhone = async (req, res) => {
  try {
    const schema = Joi.object({
      phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const userId = req.user.id;
    const { phone } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { phone },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Update store contact if exists
    if (updatedUser.role === "seller") {
      await Store.updateOne(
        { seller: userId },
        { "contact.phone": phone }
      );
    }

    return res.status(200).json({ 
      success: true,
      message: "Phone number updated successfully",
      user: updatedUser
    });

  } catch (err) {
    console.error("Change Phone Error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

module.exports = {
  registerUser,
  verifyUser,
  loginUser,
  userDashboard,
  logout,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  completeProfile,
  editBuyerProfile,
  editSellerProfile,
  changePhone
};