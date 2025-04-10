const db = require("../DB/db");
const util = require("util");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const {
  isValidEmail,
  sendOTP,
  generateOTP,
  sendResetEmail,
} = require("../Utils/Common");
const query = util.promisify(db.query).bind(db);

const SignUp = async (req, res) => {
  try {
    const { name, email, password, number, address, profile_photo } = req.body;

    // ✅ Check required fields
    if (!name || !email || !password) {
      return res.json({
        status: 400,
        data: { message: "Name, email, and password are required." },
      });
    }

    // ✅ Validate email format
    if (!isValidEmail(email)) {
      return res.json({
        status: 400,
        data: { message: "Invalid email format." },
      });
    }

    // ✅ Check if user already exists
    const existingUser = await query(
      "SELECT id, is_verified FROM users WHERE email = ?",
      [email]
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    if (existingUser.length > 0) {
      const user = existingUser[0];

      if (!user.is_verified) {
        // ✅ User exists but not verified - Update details & Resend OTP
        await query(
          `UPDATE users SET 
            name = ?, 
            password = ?, 
            number = ?, 
            address = ?, 
            profile_photo = ?, 
            otp = ? 
          WHERE email = ?`,
          [
            name,
            hashedPassword,
            number || null,
            address || "Not Provided",
            profile_photo || null,
            otp,
            email,
          ]
        );

        await sendOTP(email, otp);

        return res.json({
          status: 20, // 202 Accepted
          data: {
            message:
              "User details updated. OTP resent. Please verify your email.",
            userId: user.id,
          },
        });
      } else {
        // ✅ User exists and is verified - Show error
        return res.json({
          status: 409,
          data: { message: "Email already exists. Please log in." },
        });
      }
    }

    // ✅ If user doesn't exist, create a new user
    await sendOTP(email, otp);

    const insertQuery = `
      INSERT INTO users (name, email, password, number, address, role, otp, is_verified, auth_token, refresh_token, profile_photo)  
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      name,
      email,
      hashedPassword,
      number || null,
      address || "Not Provided",
      "user",
      otp,
      false,
      null,
      null,
      profile_photo || null,
    ];

    const result = await query(insertQuery, values);

    return res.json({
      status: 200,
      data: {
        message: "User registered successfully. Please verify your email.",
        userId: result.insertId,
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const ResendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json({ status: 400, data: { message: "Email is required." } });
    }

    const user = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (user.length === 0) {
      return res.json({ status: 404, data: { message: "User not found." } });
    }

    const otp = generateOTP();
    await query("UPDATE users SET otp = ? WHERE email = ?", [otp, email]);
    await sendOTP(email, otp);

    return res.json({
      status: 200,
      data: { message: "OTP resent successfully." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const VerifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.json({
        status: 400,
        data: { message: "Email and OTP are required." },
      });
    }

    const user = await query("SELECT id, otp FROM users WHERE email = ?", [
      email,
    ]);
    if (user.length === 0) {
      return res.json({ status: 404, data: { message: "User not found." } });
    }

    if (user[0].otp !== otp) {
      return res.json({ status: 400, data: { message: "Invalid OTP." } });
    }

    await query(
      "UPDATE users SET is_verified = ?, otp = NULL WHERE email = ?",
      [true, email]
    );

    return res.json({
      status: 200,
      data: { message: "OTP verified successfully. Account activated." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const SignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.json({
        status: 400,
        data: { message: "Email and password are required." },
      });
    }

    // Check if user exists
    const user = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0) {
      return res.json({ status: 404, data: { message: "User not found." } });
    }

    // Check if user is verified
    if (!user[0].is_verified) {
      return res.json({
        status: 403,
        data: { message: "Account not verified. Please verify your email." },
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user[0].password);
    if (!isMatch) {
      return res.json({
        status: 401,
        data: { message: "Invalid credentials." },
      });
    }

    // Generate JWT token
    const authToken = jwt.sign(
      { id: user[0].id, role: user[0].role },
      process.env.SECRET_KEY,
      {
        expiresIn: "1d",
      }
    );

    // Store the token in the database
    await query("UPDATE users SET auth_token = ? WHERE id = ?", [
      authToken,
      user[0].id,
    ]);

    return res.json({
      status: 200,
      data: {
        message: "Sign in successful.",
        user: {
          id: user[0].id,
          name: user[0].name,
          email: user[0].email,
          number: user[0].number,
          address: user[0].address,
          profile_photo: user[0].profile_photo,
          role: user[0].role,
          auth_token: authToken,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const ForgotPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json({ status: 400, data: { message: "Email is required." } });
    }

    const user = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (user.length === 0) {
      return res.json({ status: 404, data: { message: "User not found." } });
    }

    // Generate JWT reset token (expires in 15 minutes)
    const resetToken = jwt.sign({ id: user[0].id }, process.env.SECRET_KEY, {
      expiresIn: "15m",
    });

    // Store token in `auth_token` field (invalidated after use)
    await query("UPDATE users SET auth_token = ? WHERE id = ?", [
      resetToken,
      user[0].id,
    ]);

    // Send reset link via email
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    await sendResetEmail(email, resetLink);

    return res.json({
      status: 200,
      data: { message: "Password reset link sent successfully." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const ResetPasswordLink = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.json({
        status: 400,
        data: { message: "Token and new password are required." },
      });
    }

    // Check if token exists in the database
    const user = await query("SELECT id FROM users WHERE auth_token = ?", [
      token,
    ]);

    if (user.length === 0) {
      return res.json({
        status: 400,
        data: { message: "Invalid or expired token." },
      });
    }

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
      return res.json({
        status: 400,
        data: { message: "Invalid or expired token." },
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password and invalidate the token (remove it)
    await query(
      "UPDATE users SET password = ?, auth_token = NULL WHERE id = ?",
      [hashedPassword, decoded.id]
    );

    return res.json({
      status: 200,
      data: { message: "Password reset successfully." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const UpdateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, number, address, profile_photo } = req.body;

    // ✅ Check if user exists
    const user = await query("SELECT id, number FROM users WHERE id = ?", [
      userId,
    ]);
    if (user.length === 0) {
      return res.json({
        status: 404,
        data: { message: "User not found." },
      });
    }

    // ✅ Handle unique constraint for number
    if (number && number !== user[0].number) {
      const existingNumber = await query(
        "SELECT id FROM users WHERE number = ?",
        [number]
      );
      if (existingNumber.length > 0) {
        return res.json({
          status: 409,
          data: { message: "Phone number already in use." },
        });
      }
    }

    // ✅ Update user details
    await query(
      `UPDATE users SET 
        name = ?, 
        number = ?, 
        address = ?, 
        profile_photo = ? 
      WHERE id = ?`,
      [
        name || user[0].name,
        number || user[0].number,
        address || user[0].address,
        profile_photo || user[0].profile_photo,
        userId,
      ]
    );

    // ✅ Fetch updated user data
    const updatedUser = await query(
      "SELECT id, name, number, address, profile_photo FROM users WHERE id = ?",
      [userId]
    );

    return res.json({
      status: 200,
      data: { message: "Profile updated successfully.", user: updatedUser[0] },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

module.exports = {
  SignUp,
  ResendOTP,
  VerifyOTP,
  SignIn,
  ForgotPasswordLink,
  ResetPasswordLink,
  UpdateUserProfile,
};
