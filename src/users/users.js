const db = require("../DB/db");
const util = require("util");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

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
    const {
      name,
      email,
      password,
      number,
      address,
      profile_photo,
      is_businessadmin,
      business_name,
      business_address,
      business_city,
      business_state,
      business_country,
      business_pincode,
      logo,
    } = req.body;

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

    // ✅ Check if user exists
    const existingUser = await query(
      "SELECT id, is_verified, role, business_id FROM users WHERE email = ?",
      [email]
    );

    // Generate OTP
    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);

    if (existingUser.length > 0) {
      const user = existingUser[0];

      if (!user.is_verified) {
        // User exists but not verified
        if (user.role === "business_admin" && !is_businessadmin) {
          // Case where business admin wants to become a user
          await query(
            "UPDATE users SET name = ?, password = ?, number = ?, address = ?, profile_photo = ?, otp = ?, role = ?, business_id = NULL WHERE email = ?",
            [
              name,
              hashedPassword,
              number || null,
              address || "Not Provided",
              profile_photo || null,
              otp,
              "user",
              email,
            ]
          );

          // Optionally, delete business details if role is changed
          await query("DELETE FROM businesses WHERE owner_id = ?", [user.id]);

          // Send OTP for verification
          await sendOTP(email, otp);

          return res.json({
            status: 200,
            data: {
              message:
                "Your account has been updated to a user role. OTP has been resent for verification.",
            },
          });
        }

        if (is_businessadmin) {
          // Case where user wants to become a business admin
          let businessResult;

          // Check if business already exists for the user
          const [existingBusiness] = await query(
            "SELECT * FROM businesses WHERE owner_id = ?",
            [user.id]
          );

          if (existingBusiness) {
            // If business exists, update it
            await query(
              "UPDATE businesses SET name = ?, address = ?, city = ?, state = ?, country = ?, pincode = ?, logo = ? WHERE id = ?",
              [
                business_name,
                business_address,
                business_city,
                business_state,
                business_country,
                business_pincode,
                logo,
                existingBusiness.id,
              ]
            );
            businessResult = existingBusiness; // Use the existing business object
          } else {
            // Create new business if it doesn't exist
            businessResult = await query(
              "INSERT INTO businesses (name, owner_id, address, city, state, country, pincode, logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                business_name,
                user.id,
                business_address,
                business_city,
                business_state,
                business_country,
                business_pincode,
                logo || null,
              ]
            );
          }

          // Update user role to business admin
          await query(
            "UPDATE users SET role = 'business_admin', business_id = ? WHERE id = ?",
            [
              businessResult.id, // Access businessResult.id after it's defined
              user.id,
            ]
          );

          // Send OTP for verification
          await sendOTP(email, otp);

          return res.json({
            status: 200,
            data: {
              message:
                "Your account has been upgraded to business admin. OTP has been resent for verification.",
            },
          });
        }
      } else {
        // User is verified and already registered
        return res.json({
          status: 409,
          data: { message: "Email already exists. Please log in." },
        });
      }
    }

    // If user doesn't exist, create new user
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
      is_businessadmin ? "business_admin" : "user",
      otp,
      false,
      null,
      null,
      profile_photo || null,
    ];
    const result = await query(insertQuery, values);

    if (is_businessadmin) {
      const businessResult = await query(
        "INSERT INTO businesses (name, owner_id, address, city, state, country, pincode, logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          business_name,
          result.insertId,
          business_address,
          business_city,
          business_state,
          business_country,
          business_pincode,
          logo || null,
        ]
      );

      // Update user with business info
      await query("UPDATE users SET business_id = ? WHERE id = ?", [
        businessResult.insertId,
        result.insertId,
      ]);
    }

    // Send OTP for verification
    await sendOTP(email, otp);

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

    // Prepare response
    const responseData = {
      id: user[0].id,
      name: user[0].name,
      email: user[0].email,
      number: user[0].number,
      address: user[0].address,
      profile_photo: user[0].profile_photo,
      role: user[0].role,
      auth_token: authToken,
    };

    // If the user is a business admin, fetch business data as well
    if (user[0].role === "business_admin" && user[0].business_id) {
      const business = await query("SELECT * FROM businesses WHERE id = ?", [
        user[0].business_id,
      ]);
      if (business.length > 0) {
        responseData.business = business[0];
      }
    }

    return res.json({
      status: 200,
      data: {
        message: "Sign in successful.",
        user: responseData,
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

const googleSignIn = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token missing" });
  }

  try {
    // Fetch user info from Google
    const { data: googleData } = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const { email, verified_email } = googleData;

    if (!verified_email) {
      return res.status(400).json({ message: "Email not verified by google" });
    }

    // Check if user exists in DB
    const [user] = await query("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        message: "Account not verified. Please verify your email.",
      });
    }

    // Generate JWT token
    const authToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "1d" }
    );

    // Save token
    await query("UPDATE users SET auth_token = ? WHERE id = ?", [
      authToken,
      user.id,
    ]);

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      number: user.number,
      address: user.address,
      profile_photo: user.profile_photo,
      role: user.role,
      auth_token: authToken,
    };

    // Attach business info if applicable
    if (user.role === "business_admin" && user.business_id) {
      const [business] = await query("SELECT * FROM businesses WHERE id = ?", [
        user.business_id,
      ]);
      if (business) userData.business = business;
    }

    return res.status(200).json({
      message: "Sign in successful.",
      user: userData,
    });
  } catch (error) {
    console.error("Google SignIn Error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const googleRegister = async (req, res) => {
  try {
    const {
      name,
      token,
      number,
      address,
      profile_photo,
      is_businessadmin,
      business_name,
      business_address,
      business_city,
      business_state,
      business_country,
      business_pincode,
      logo,
    } = req.body;

    if (!name || !token) {
      return res.status(400).json({
        message: "Name and token are required.",
      });
    }

    // ✅ Get email from Google
    const googleRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { email, verified_email } = googleRes.data;
    if (!verified_email) {
      return res.status(400).json({ message: "Google email not verified." });
    }

    // ✅ Check if user exists
    const existingUsers = await query(
      "SELECT id, is_verified, role, business_id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: "Email already exists. Please log in.",
      });
    }

    // ✅ Insert new user
    const role = is_businessadmin ? "business_admin" : "user";
    const insertUserQuery = `
      INSERT INTO users 
      (name, email, password, number, address, role, otp, is_verified, auth_token, refresh_token, profile_photo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const userValues = [
      name,
      email,
      "GOOGLE_AUTH_USER",
      number || "0000000000",
      address || "Signed up with Google",
      role,
      null, // otp
      true, // is_verified
      null, // auth_token (will update later)
      null, // refresh_token
      profile_photo || null,
    ];
    const userResult = await query(insertUserQuery, userValues);

    let business = null;

    if (is_businessadmin) {
      // ✅ Create business and link to user
      const businessInsert = await query(
        `INSERT INTO businesses 
         (name, owner_id, address, city, state, country, pincode, logo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          business_name,
          userResult.insertId,
          business_address,
          business_city,
          business_state,
          business_country,
          business_pincode,
          logo || null,
        ]
      );

      // ✅ Update user with business_id
      await query("UPDATE users SET business_id = ? WHERE id = ?", [
        businessInsert.insertId,
        userResult.insertId,
      ]);

      // Get business data for response
      [business] = await query("SELECT * FROM businesses WHERE id = ?", [
        businessInsert.insertId,
      ]);
    }

    // ✅ Get created user
    const [user] = await query("SELECT * FROM users WHERE id = ?", [
      userResult.insertId,
    ]);

    // ✅ Generate and save token
    const authToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "1d" }
    );
    await query("UPDATE users SET auth_token = ? WHERE id = ?", [
      authToken,
      user.id,
    ]);

    // ✅ Response
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      number: user.number,
      address: user.address,
      profile_photo: user.profile_photo,
      role: user.role,
      auth_token: authToken,
      ...(business && { business }), // attach business if present
    };

    return res.status(200).json({
      message: "Sign in successful.",
      user: userData,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
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
  googleRegister,
  googleSignIn,
};
