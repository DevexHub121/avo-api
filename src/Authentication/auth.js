const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticate = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.json({
      status: 401,
      data: { message: "Access denied. No token provided." },
    });
  }
  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", "").trim(),
      process.env.SECRET_KEY
    );
    req.user = decoded;
    next();
  } catch (error) {
    res.json({
      status: 401,
      data: { message: "Invalid token", error: error },
    });
  }
};

// ✅ Middleware to check if the user is a business admin
const isBusinessAdmin = (req, res, next) => {
  if (req.user.role !== "business_admin") {
    return res.json({
      status: 403,
      data: {
        message: "Access denied. Only business admins can perform this action.",
      },
    });
  }
  next();
};

module.exports = { authenticate, isBusinessAdmin };
