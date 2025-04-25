const db = require("../DB/db");
const util = require("util");
const bcrypt = require("bcryptjs");
const { isValidEmail } = require("../Utils/Common");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const query = util.promisify(db.query).bind(db);

// Register Business API
const RegisterOrUpdateBusiness = async (req, res) => {
  const { business_id, business_name, business_address, logo } = req.body;
  const user_id = req.user.id; // Logged-in user ID
  const user_role = req.user.role; // Logged-in user role

  if (!business_name) {
    return res.json({
      status: 400,
      data: { message: "Business name is required." },
    });
  }

  try {
    if (business_id) {
      // ✅ Update Business (If business_id is provided)
      if (user_role !== "business_admin") {
        return res.json({
          status: 403,
          data: {
            message:
              "Unauthorized: Only business admins can update business details.",
          },
        });
      }

      // ✅ Check if business exists and belongs to the user
      const [business] = await query(
        "SELECT * FROM businesses WHERE id = ? AND owner_id = ?",
        [business_id, user_id]
      );
      if (!business) {
        return res.json({
          status: 404,
          data: { message: "Business not found or unauthorized." },
        });
      }

      // ✅ Update business details
      await query(
        "UPDATE businesses SET name = ?, address = ?, logo = ? WHERE id = ?",
        [
          business_name || business.name,
          business_address || business.address,
          logo || business.logo,
          business_id,
        ]
      );

      return res.json({
        status: 200,
        data: { message: "Business updated successfully." },
      });
    } else {
      // ✅ Register New Business (If business_id is not provided)

      // Check if user already owns a business
      const [user] = await query("SELECT * FROM users WHERE id = ?", [user_id]);
      if (!user) {
        return res.json({
          status: 404,
          data: { message: "User not found." },
        });
      }
      if (user.role === "business_admin") {
        return res.json({
          status: 400,
          data: { message: "User is already a business admin." },
        });
      }

      // ✅ Insert new business
      const businessResult = await query(
        "INSERT INTO businesses (name, owner_id, address, logo) VALUES (?, ?, ?, ?)",
        [business_name, user_id, business_address, logo || null]
      );
      const newBusinessId = businessResult.insertId;

      // ✅ Generate new auth token with updated role
      const newAuthToken = jwt.sign(
        { id: user_id, role: "business_admin", business_id: newBusinessId },
        process.env.SECRET_KEY,
        { expiresIn: "7d" }
      );

      // ✅ Update user role and business_id
      await query(
        "UPDATE users SET role = 'business_admin', business_id = ?, auth_token = ? WHERE id = ?",
        [newBusinessId, newAuthToken, user_id]
      );

      // ✅ Fetch and return the updated user details
      const [updatedUser] = await query(
        `SELECT id, name, email, number, address, profile_photo, role, business_id, auth_token
         FROM users WHERE id = ?`,
        [user_id]
      );

      return res.json({
        status: 200,
        data: {
          message: "Business registered successfully.",
          business: {
            id: newBusinessId,
            name: business_name,
            address: business_address,
            logo: logo || null,
          },
          updated_user: updatedUser,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const UpdateBusiness = async (req, res) => {
  const {
    business_name,
    business_address,
    city,
    state,
    country,
    pincode,
    logo,
  } = req.body;
  const user_id = req.user.id; // Logged-in user ID
  const user_role = req.user.role; // Logged-in user role

  // Check if the user is a business admin
  if (user_role !== "business_admin") {
    return res.json({
      status: 403,
      data: {
        message:
          "Unauthorized: Only business admins can update business details.",
      },
    });
  }

  try {
    // ✅ Get the business_id associated with the user
    const [user] = await query("SELECT business_id FROM users WHERE id = ?", [
      user_id,
    ]);

    // If the user is not associated with a business
    if (!user || !user.business_id) {
      return res.json({
        status: 404,
        data: { message: "Business not found for this user." },
      });
    }

    const business_id = user.business_id;

    // ✅ Get the existing business data
    const [business] = await query("SELECT * FROM businesses WHERE id = ?", [
      business_id,
    ]);

    // If the business does not exist
    if (!business) {
      return res.json({
        status: 404,
        data: { message: "Business not found." },
      });
    }

    // ✅ Update business details
    await query(
      "UPDATE businesses SET name = ?, address = ?, city = ?, state = ?, country = ?, pincode = ?, logo = ? WHERE id = ?",
      [
        business_name || business.name,
        business_address || business.address,
        city || business.city,
        state || business.state,
        country || business.country,
        pincode || business.pincode,
        logo || business.logo,
        business_id,
      ]
    );

    // Fetch updated business details
    const [updatedBusiness] = await query(
      "SELECT * FROM businesses WHERE id = ?",
      [business_id]
    );

    return res.json({
      status: 200,
      data: {
        message: "Business updated successfully.",
        business: updatedBusiness, // Return updated business details
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

const GetBusinessByUserId = async (req, res) => {
  try {
    const user_id = req.user.id; // Logged-in user ID

    // ✅ Fetch business details where the user is the owner
    const business = await query(
      "SELECT id, name, address, logo FROM businesses WHERE owner_id = ?",
      [user_id]
    );

    // ✅ Check if business exists
    if (!business) {
      return res.json({
        status: 404,
        data: { message: "Business not found for this user." },
      });
    }

    return res.json({
      status: 200,
      data: business[0],
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const AddEmployee = async (req, res) => {
  try {
    const { name, email, password, number, address, profile_photo } = req.body;
    const admin_id = req.user.id; // Extract business admin ID from token

    // ✅ Validate required fields
    if (!name || !email || !password) {
      return res.json({
        status: 400,
        data: { message: "Name, email, and password are required." },
      });
    }

    // ✅ Check if the user is a business admin
    const adminRows = await query("SELECT * FROM users WHERE id = ?", [
      admin_id,
    ]);
    if (!adminRows.length || adminRows[0].role !== "business_admin") {
      return res.json({
        status: 403,
        data: {
          message: "Unauthorized: Only business admins can add employees.",
        },
      });
    }

    // ✅ Check if business exists
    if (!adminRows[0].business_id) {
      return res.json({
        status: 400,
        data: {
          message: "Business not found. Please register a business first.",
        },
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.json({
        status: 400,
        data: { message: "Invalid email format." },
      });
    }

    // ✅ Check if email already exists
    const existingUser = await query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existingUser.length > 0) {
      return res.json({
        status: 409,
        data: { message: "Email already in use." },
      });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Set default values for optional fields
    const employeeData = {
      name,
      email,
      password: hashedPassword,
      number: number || null,
      address: address || "Not Provided",
      profile_photo: profile_photo || null,
      role: "employee",
      business_id: adminRows[0].business_id,
      is_verified: true, // Employees are auto-verified
    };

    // ✅ SQL query for insertion
    const insertQuery = `
      INSERT INTO users (name, email, password, number, address, profile_photo, role, business_id, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      employeeData.name,
      employeeData.email,
      employeeData.password,
      employeeData.number,
      employeeData.address,
      employeeData.profile_photo,
      employeeData.role,
      employeeData.business_id,
      employeeData.is_verified,
    ];

    // ✅ Execute query
    const result = await query(insertQuery, values);

    return res.json({
      status: 200,
      data: {
        message: "Employee added successfully",
        employee_id: result.insertId,
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

const UpdateEmployee = async (req, res) => {
  try {
    const { employee_id, name, number, address, profile_photo, password } =
      req.body;
    const user_id = req.user.id; // Logged-in user ID
    const user_role = req.user.role; // Logged-in user role

    // ✅ Check if employee_id is provided
    if (!employee_id) {
      return res.json({
        status: 400,
        data: { message: "Employee ID is required." },
      });
    }

    // ✅ Fetch employee details
    const employeeRows = await query("SELECT * FROM users WHERE id = ?", [
      employee_id,
    ]);
    if (!employeeRows.length) {
      return res.json({
        status: 404,
        data: { message: "Employee not found." },
      });
    }
    const employee = employeeRows[0];

    // ✅ Authorization checks
    if (user_role === "business_admin") {
      // Business admin can update any employee in their business
      const adminRows = await query("SELECT * FROM users WHERE id = ?", [
        user_id,
      ]);
      if (
        !adminRows.length ||
        adminRows[0].business_id !== employee.business_id
      ) {
        return res.json({
          status: 403,
          data: {
            message:
              "Unauthorized: You can only update employees in your business.",
          },
        });
      }
    } else if (user_role === "employee") {
      // Employees can only update their own details and NOT password
      if (parseInt(user_id) !== parseInt(employee_id)) {
        return res.json({
          status: 403,
          data: {
            message:
              "Unauthorized: Employees can only update their own profile.",
          },
        });
      }
      if (password) {
        return res.json({
          status: 403,
          data: { message: "Employees cannot update their password." },
        });
      }
    } else {
      return res.json({
        status: 403,
        data: { message: "Unauthorized: Access denied." },
      });
    }

    // ✅ Prevent email updates
    if (req.body.email && req.body.email !== employee.email) {
      return res.json({
        status: 400,
        data: { message: "Email cannot be updated." },
      });
    }

    // ✅ Hash password if provided (only admins can update it)
    let hashedPassword = employee.password;
    if (password && user_role === "business_admin") {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // ✅ Update query
    const updateQuery = `
      UPDATE users SET 
        name = ?, 
        number = ?, 
        address = ?, 
        profile_photo = ?, 
        password = ?,
      WHERE id = ?
    `;

    const values = [
      name || employee.name,
      number || employee.number,
      address || employee.address,
      profile_photo || employee.profile_photo,
      hashedPassword, // Only updates if admin provided a new password
      employee_id,
    ];
    await query(updateQuery, values);

    return res.json({
      status: 200,
      data: { message: "Employee updated successfully." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const DeleteEmployee = async (req, res) => {
  try {
    const { employee_id } = req.query;
    const admin_id = req.user.id;

    // ✅ Check if the user is a business admin
    const adminRows = await query("SELECT * FROM users WHERE id = ?", [
      admin_id,
    ]);
    if (!adminRows.length || adminRows[0].role !== "business_admin") {
      return res.json({
        status: 403,
        data: {
          message: "Unauthorized: Only business admins can delete employees.",
        },
      });
    }

    // ✅ Check if business exists
    if (!adminRows[0].business_id) {
      return res.json({
        status: 400,
        data: {
          message: "Business not found. Please register a business first.",
        },
      });
    }

    // ✅ Check if employee exists and belongs to the admin's business
    const employeeRows = await query(
      "SELECT * FROM users WHERE id = ? AND business_id = ? AND role = 'employee'",
      [employee_id, adminRows[0].business_id]
    );
    if (!employeeRows.length) {
      return res.json({
        status: 404,
        data: {
          message: "Employee not found or does not belong to your business.",
        },
      });
    }

    // ✅ Delete query
    await query("DELETE FROM users WHERE id = ? AND business_id = ?", [
      employee_id,
      adminRows[0].business_id,
    ]);

    return res.json({
      status: 200,
      data: { message: "Employee deleted successfully." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const GetEmployeesByBusiness = async (req, res) => {
  try {
    const { business_id } = req.query;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // ✅ Ensure business_id is provided
    if (!business_id) {
      return res.json({
        status: 400,
        data: { message: "Business ID is required." },
      });
    }

    // ✅ If user is a business admin, check if they own this business
    if (user_role === "business_admin") {
      const adminRows = await query(
        "SELECT * FROM users WHERE id = ? AND business_id = ?",
        [user_id, business_id]
      );

      if (!adminRows.length) {
        return res.json({
          status: 403,
          data: {
            message: "Unauthorized: You don't have access to this business.",
          },
        });
      }
    }

    // ✅ Fetch employees for the given business_id
    const employees = await query(
      "SELECT id, name, email, number, address, profile_photo, created_at FROM users WHERE business_id = ? AND role = 'employee'",
      [business_id]
    );

    return res.json({
      status: 200,
      data: { employees },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const GetUserById = async (req, res) => {
  try {
    const employee_id = req.user.id;

    // ✅ Fetch user details
    const employee = await query(
      "SELECT id, name, email, number,role, address, profile_photo, business_id FROM users WHERE id = ?",
      [employee_id]
    );

    // ✅ Check if user exists
    if (!employee) {
      return res.json({
        status: 404,
        data: { message: "User not found." },
      });
    }

    return res.json({
      status: 200,
      data: employee[0],
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const GetUserByIdReq = async (req, res) => {
  try {
    const employee_id = req.query.id;

    // ❌ Check if ID is missing or empty
    if (!employee_id) {
      return res.json({
        status: 400,
        data: { message: "Invalid request. ID is required." },
      });
    }

    // ✅ Fetch user details
    const employee = await query(
      "SELECT id, name, email, number,role, address, profile_photo, business_id FROM users WHERE id = ?",
      [employee_id]
    );

    // ✅ Check if user exists
    if (!employee) {
      return res.json({
        status: 404,
        data: { message: "User not found." },
      });
    }

    return res.json({
      status: 200,
      data: employee[0],
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const getCouponUsageForBusinessAdmin = async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!user_id) {
      return res.json({
        status: 400,
        data: { message: "User ID is required." },
      });
    }

    // Pagination parameters (default: page 1, limit 10)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Step 1: Get all businesses owned by this user
    const businesses = await query(
      `SELECT id FROM businesses WHERE owner_id = ?`,
      [user_id]
    );

    if (businesses.length === 0) {
      return res.json({
        status: 200,
        data: { message: "No businesses found for this user." },
      });
    }

    // Extract business IDs
    const businessIds = businesses.map((b) => b.id);

    // Step 2: Fetch total count of coupon usage for pagination
    const totalCountResult = await query(
      `SELECT COUNT(*) AS total FROM coupon_usage WHERE business_id IN (?)`,
      [businessIds]
    );
    const totalRecords = totalCountResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Step 3: Fetch paginated coupon usage for these businesses
    const couponUsageData = await query(
      `SELECT u.name AS username, 
              b.name AS business_name,
              o.title AS coupon_used, 
              cu.used_at AS usage_date
       FROM coupon_usage cu
       JOIN users u ON cu.user_id = u.id
       JOIN offers o ON cu.offer_id = o.id
       JOIN businesses b ON cu.business_id = b.id
       WHERE cu.business_id IN (?)
       ORDER BY cu.used_at DESC
       LIMIT ? OFFSET ?`,
      [businessIds, limit, offset]
    );

    return res.json({
      status: 200,
      data: {
        total_records: totalRecords,
        total_pages: totalPages,
        current_page: page,
        per_page: limit,
        results: couponUsageData.length > 0 ? couponUsageData : [],
        message:
          couponUsageData.length === 0
            ? "No coupon usage found for your businesses."
            : null,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching coupon usage:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

module.exports = {
  AddEmployee,
  DeleteEmployee,
  UpdateEmployee,
  RegisterOrUpdateBusiness,
  GetEmployeesByBusiness,
  GetUserById,
  GetBusinessByUserId,
  GetUserByIdReq,
  getCouponUsageForBusinessAdmin,
  UpdateBusiness,
};
