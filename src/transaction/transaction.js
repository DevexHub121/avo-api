const db = require("../DB/db");
const util = require("util");

const query = util.promisify(db.query).bind(db);

// 📌 Create a Transaction
const createTransaction = async (req, res) => {
  try {
    const {
      amount,
      currency,
      payment_method,
      transaction_id,
      status,
      details,
    } = req.body;
    const user_id = req.user.id;

    if (!amount || !payment_method || !transaction_id || !status) {
      return res.json({
        status: 400,
        data: { message: "Missing required fields." },
      });
    }

    // 🔍 Check if transaction already exists
    const existingTransaction = await query(
      "SELECT id FROM transactions WHERE transaction_id = ?",
      [transaction_id]
    );

    if (existingTransaction.length > 0) {
      return res.json({
        status: 409, // 409 Conflict
        data: { message: "Transaction already exists." },
      });
    }

    // ✅ Insert the transaction if it does not exist
    const result = await query(
      "INSERT INTO transactions (user_id, amount, currency, payment_method, transaction_id, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        user_id,
        amount,
        currency || "USD",
        payment_method,
        transaction_id,
        status,
        details || null,
      ]
    );

    res.json({
      status: 201,
      data: { message: "Transaction recorded successfully", transaction_id },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

// 📌 Update Transaction Status (Admin or System)
const UpdateTransaction = async (req, res) => {
  try {
    const { trx_id } = req.query;
    const { status } = req.body;

    if (!["pending", "completed", "failed", "refunded"].includes(status)) {
      return res.json({
        status: 400,
        data: {
          message: "Invalid status value.",
          useFormat: ["pending", "completed", "failed", "refunded"],
        },
      });
    }

    const result = await query(
      "UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?",
      [status, trx_id]
    );

    if (result.affectedRows === 0) {
      return res.json({
        status: 404,
        data: { message: "Transaction not found." },
      });
    }

    res.json({
      status: 200,
      data: { message: "Transaction status updated successfully." },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

// 📌 Get User Transactions
const getTransaction = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { trx_id } = req.query;

    let transactions;

    if (trx_id) {
      // Get specific transaction by transaction_id
      transactions = await query(
        "SELECT * FROM transactions WHERE user_id = ? AND transaction_id = ?",
        [user_id, trx_id]
      );

      if (transactions.length === 0) {
        return res.json({
          status: 404,
          data: { message: "Transaction not found." },
        });
      }
    } else {
      // Get all transactions for the user
      transactions = await query(
        "SELECT * FROM transactions WHERE user_id = ?",
        [user_id]
      );
    }

    res.json({ status: 200, data: { transactions } });
  } catch (error) {
    console.error("❌ Error:", error);
    res.json({
      status: 500,
      data: { message: "Internal Server Error", error: error.message },
    });
  }
};

module.exports = {
  createTransaction,
  UpdateTransaction,
  getTransaction,
};
