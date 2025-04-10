const db = require("../DB/db");
const util = require("util");

const query = util.promisify(db.query).bind(db);

const createOrUpdateOffer = async (req, res) => {
  const user_id = req.user.id;
  const {
    offer_id, // If provided, update the offer
    title,
    description,
    image,
    discount_percentage,
    price,
    start_date,
    end_date,
    max_usage,
  } = req.body;

  try {
    // Check if the user owns a business
    const business = await query(
      "SELECT id FROM businesses WHERE owner_id = ?",
      [user_id]
    );

    if (business.length === 0) {
      return res.status(403).json({
        status: 403,
        data: { message: "You do not own any business." },
      });
    }

    const business_id = business[0].id;

    // If max_usage is not provided, set it to NULL
    const maxUsageValue =
      max_usage !== undefined && max_usage !== "" ? max_usage : null;

    if (offer_id) {
      // Update existing offer
      const existingOffer = await query(
        "SELECT * FROM offers WHERE id = ? AND business_id = ?",
        [offer_id, business_id]
      );

      if (existingOffer.length === 0) {
        return res.status(404).json({
          status: 404,
          data: { message: "Offer not found or you do not own this offer." },
        });
      }

      await query(
        `UPDATE offers 
         SET title = ?, description = ?, image = ?, discount_percentage = ?, price = ?, start_date = ?, end_date = ?, max_usage = ? 
         WHERE id = ?`,
        [
          title,
          description,
          image,
          discount_percentage,
          price,
          start_date,
          end_date,
          maxUsageValue, // ✅ Use NULL if max_usage is missing
          offer_id,
        ]
      );

      const updatedOffer = await query("SELECT * FROM offers WHERE id = ?", [
        offer_id,
      ]);

      return res.json({
        status: 200,
        data: {
          message: "Offer updated successfully",
          offer: updatedOffer[0],
        },
      });
    } else {
      // Create a new offer
      const result = await query(
        `INSERT INTO offers (business_id, title, description, image, discount_percentage, price, start_date, end_date, max_usage) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          business_id,
          title,
          description,
          image,
          discount_percentage,
          price,
          start_date,
          end_date,
          maxUsageValue, // ✅ Use NULL if max_usage is missing
        ]
      );

      const newOffer = await query("SELECT * FROM offers WHERE id = ?", [
        result.insertId,
      ]);

      return res.json({
        status: 200,
        data: {
          message: "Offer created successfully",
          offer: newOffer[0],
        },
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const deleteOffer = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.query;

  try {
    const offer = await query(
      "SELECT * FROM offers WHERE id = ? AND business_id IN (SELECT id FROM businesses WHERE owner_id = ?)",
      [id, user_id]
    );

    if (offer.length === 0) {
      return res.status(403).json({
        status: 403,
        data: { message: "You do not own this offer." },
      });
    }

    await query("DELETE FROM offers WHERE id = ?", [id]);

    res.json({
      status: 200,
      data: { message: "Offer deleted successfully" },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const publishUnpublishOffer = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.query;
  const { is_published } = req.body;

  try {
    const offer = await query(
      "SELECT * FROM offers WHERE id = ? AND business_id IN (SELECT id FROM businesses WHERE owner_id = ?)",
      [id, user_id]
    );

    if (offer.length === 0) {
      return res.status(403).json({
        status: 403,
        data: { message: "You do not own this offer." },
      });
    }

    await query("UPDATE offers SET is_published = ? WHERE id = ?", [
      is_published,
      id,
    ]);

    res.json({
      status: 200,
      data: {
        message: `Offer ${
          is_published ? "published" : "unpublished"
        } successfully`,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const publishedOfferList = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count of published offers
    const totalCountResult = await query(
      "SELECT COUNT(*) AS total FROM offers WHERE is_published = TRUE"
    );
    const totalItems = totalCountResult[0].total;

    // Fetch paginated offers
    const offers = await query(
      "SELECT * FROM offers WHERE is_published = TRUE LIMIT ? OFFSET ?",
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      status: 200,
      data: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: parseInt(page),
        offers,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

const businessOfferList = async (req, res) => {
  const user_id = req.user.id;
  const { business_id } = req.query;

  try {
    const business = await query(
      "SELECT * FROM businesses WHERE id = ? AND owner_id = ?",
      [business_id, user_id]
    );

    if (business.length === 0) {
      return res.json({
        status: 403,
        data: { message: "You do not own this business." },
      });
    }

    const offers = await query("SELECT * FROM offers WHERE business_id = ?", [
      business_id,
    ]);

    res.json({
      status: 200,
      data: { offers },
    });
  } catch (error) {
    res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

module.exports = {
  createOrUpdateOffer,
  deleteOffer,
  publishUnpublishOffer,
  publishedOfferList,
  businessOfferList,
};
