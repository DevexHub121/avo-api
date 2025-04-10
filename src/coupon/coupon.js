const db = require("../DB/db");
const util = require("util");

const query = util.promisify(db.query).bind(db);

const RedeemCoupon = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { offer_id, business_id } = req.body;

    if (!offer_id || !business_id) {
      return res.json({
        status: 400,
        data: { message: "Offer ID and Business ID are required." },
      });
    }

    // Check if the coupon is already redeemed
    const existing = await query(
      `SELECT id FROM redeemed_coupons WHERE user_id = ? AND offer_id = ?`,
      [user_id, offer_id]
    );

    if (existing.length > 0) {
      return res.json({
        status: 400,
        data: { message: "Coupon already redeemed." },
      });
    }

    // Validate offer details
    const [offer] = await query(
      `SELECT start_date, end_date, max_usage FROM offers WHERE id = ?`,
      [offer_id]
    );

    if (!offer) {
      return res.json({ status: 404, data: { message: "Offer not found." } });
    }

    const now = new Date();
    if (now < new Date(offer.start_date) || now > new Date(offer.end_date)) {
      return res.json({
        status: 400,
        data: { message: "Offer is expired or not yet valid." },
      });
    }

    // ✅ Save the redeemed coupon (Only Once)
    await query(
      `INSERT INTO redeemed_coupons (user_id, offer_id, business_id) VALUES (?, ?, ?)`,
      [user_id, offer_id, business_id]
    );

    return res.json({
      status: 200,
      data: { message: "Coupon successfully claimed!" },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const UseCoupon = async (req, res) => {
  try {
    const { offer_id, user_id } = req.body;

    if (!offer_id) {
      return res.json({
        status: 400,
        data: { message: "Offer ID is required." },
      });
    }

    // Fetch the business_id and max_usage linked to this offer
    const [offer] = await query(
      `SELECT business_id, max_usage, start_date, end_date FROM offers WHERE id = ?`,
      [offer_id]
    );

    if (!offer) {
      return res.json({
        status: 404,
        data: { message: "Offer not found." },
      });
    }

    const { business_id, max_usage, start_date, end_date } = offer;

    // Check if the coupon is redeemed
    const redeemed = await query(
      `SELECT id FROM redeemed_coupons WHERE user_id = ? AND offer_id = ?`,
      [user_id, offer_id]
    );

    if (redeemed.length === 0) {
      return res.json({
        status: 400,
        data: { message: "You haven't redeemed this coupon yet." },
      });
    }

    // Validate offer period
    const now = new Date();
    if (now < new Date(start_date) || now > new Date(end_date)) {
      return res.json({
        status: 400,
        data: { message: "Coupon is expired or not yet valid." },
      });
    }

    // **🛠️ Unlimited Usage Handling: If max_usage is NULL, skip limit check**
    if (max_usage !== null) {
      // Get current usage count
      const [offerUsage] = await query(
        `SELECT COALESCE(COUNT(cu.id), 0) AS usage_count 
           FROM coupon_usage cu
           WHERE cu.offer_id = ? AND cu.user_id = ?`,
        [offer_id, user_id]
      );

      const currentUsage = offerUsage?.usage_count || 0;

      // Check if coupon usage limit is reached
      if (currentUsage >= max_usage) {
        return res.json({
          status: 400,
          data: {
            message: `Coupon usage limit reached (${max_usage} times).`,
          },
        });
      }
    }

    // ✅ Insert usage record
    await query(
      `INSERT INTO coupon_usage (user_id, offer_id, business_id) VALUES (?, ?, ?)`,
      [user_id, offer_id, business_id]
    );

    return res.json({
      status: 200,
      data: { message: "Coupon used successfully!" },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const GetRedeemedCouponsWithUsage = async (req, res) => {
  try {
    const user_id = req.query.user_id;

    const redeemedCoupons = await query(
      `SELECT 
              o.id AS offer_id, 
              o.title, 
              o.image, 
              o.max_usage, 
              r.redeemed_at, 
              COALESCE(COUNT(cu.id), 0) AS usage_count
           FROM redeemed_coupons r
           JOIN offers o ON r.offer_id = o.id
           LEFT JOIN coupon_usage cu ON r.user_id = cu.user_id AND r.offer_id = cu.offer_id
           WHERE r.user_id = ?
           GROUP BY o.id, o.title, o.image, o.max_usage, r.redeemed_at`,
      [user_id]
    );

    return res.json({ status: 200, data: { redeemedCoupons } });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const GetCouponUsageDetails = async (req, res) => {
  try {
    const { offer_id, user_id } = req.query;

    if (!offer_id) {
      return res.json({
        status: 400,
        data: { message: "Offer ID is required." },
      });
    }

    // Fetch usage history
    const usageHistory = await query(
      `SELECT used_at FROM coupon_usage WHERE user_id = ? AND offer_id = ? ORDER BY used_at ASC`,
      [user_id, offer_id]
    );

    return res.json({ status: 200, data: { usageHistory } });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const GetBusinessEmployeesWithCoupons = async (req, res) => {
  try {
    const admin_id = req.user.id; // Assuming auth middleware sets req.user

    // Get business_id for the admin
    const [admin] = await query(
      `SELECT u.id, u.name, u.email, u.number, u.address, u.profile_photo, b.id AS business_id
       FROM users u
       JOIN businesses b ON u.id = b.owner_id
       WHERE u.id = ? AND u.role = 'business_admin'`,
      [admin_id]
    );

    if (!admin) {
      return res.json({
        status: 403,
        data: {
          message: "Access denied. Only business admins can access this.",
        },
      });
    }

    const business_id = admin.business_id;

    // Get employees for this business
    const employees = await query(
      `SELECT id, name, email, number, profile_photo, address, created_at
       FROM users WHERE business_id = ? AND role = 'employee'`,
      [business_id]
    );

    // Fetch redeemed coupons and usage history for each employee
    for (const employee of employees) {
      const redeemedCoupons = await query(
        `SELECT 
          r.offer_id,
          o.title, 
          o.image, 
          r.redeemed_at,
          COALESCE(COUNT(cu.id), 0) AS usage_count
         FROM redeemed_coupons r
         JOIN offers o ON r.offer_id = o.id
         LEFT JOIN coupon_usage cu 
         ON r.user_id = cu.user_id AND r.offer_id = cu.offer_id
         WHERE r.user_id = ?
         GROUP BY r.offer_id, o.title, o.image, r.redeemed_at`,
        [employee.id]
      );

      // Fetch usage history (used_at timestamps) for each redeemed coupon
      for (const coupon of redeemedCoupons) {
        const usageHistory = await query(
          `SELECT used_at FROM coupon_usage 
           WHERE user_id = ? AND offer_id = ? 
           ORDER BY used_at ASC`,
          [employee.id, coupon.offer_id]
        );

        coupon.usage_history = usageHistory.map((entry) => entry.used_at);
      }

      employee.redeemed_coupons = redeemedCoupons;
    }

    return res.json({
      status: 200,
      data: {
        business_admin: admin,
        employees: employees,
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

const getValidCouponsForUser = async (req, res) => {
  try {
    const business_admin_id = req.user.id;
    const { user_id } = req.query;

    if (!user_id || !business_admin_id) {
     return res.json({
        status: 400,
        data: { message: "User ID and Business Admin ID are required." },
     });
    }

    const redeemedCoupons = await query(
     `SELECT o.id, o.title, o.description, o.image, o.discount_percentage,
             o.price, o.start_date, o.end_date, o.is_published, rc.redeemed_at
     FROM offers o
     JOIN businesses b ON o.business_id = b.id
     JOIN redeemed_coupons rc ON o.id = rc.offer_id
     WHERE b.owner_id = ?
     AND rc.user_id = ?`,
     [business_admin_id, user_id]
    );

    return res.json({
     status: 200,
     data:
        redeemedCoupons.length > 0
         ? redeemedCoupons
         : { message: "No redeemed coupons found." },
    });
} catch (error) {
    console.error("❌ Error fetching redeemed coupons:", error);
    return res.json({
     status: 500,
     data: { message: "Internal Server Error", error: error.message },
    });
}
};

module.exports = {
  RedeemCoupon,
  UseCoupon,
  GetRedeemedCouponsWithUsage,
  GetCouponUsageDetails,
  GetBusinessEmployeesWithCoupons,
  getValidCouponsForUser,
};
