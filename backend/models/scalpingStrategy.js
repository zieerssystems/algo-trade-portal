const express = require("express");
const pool = require("../config/db").default;
const router = express.Router();

/**
 * Fetch Scalping Data
 */
router.get("/scalping", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "User ID is required" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM scalping_strategy WHERE user_id = ?",
      [user_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Scalping data not found" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Update Scalping Data
 */
router.put("/scalping", async (req, res) => {
  const {
    user_id,
    exch,
    stock_name,
    price_type,
    initial_buy_price,
    buy_on_market,
    target_price_diff,
    entry_diff_price,
    lot_size,
    max_open_position,
    duration,
    stop_loss,
    market_closing_time,
    debug_on,
  } = req.body;

  if (!user_id) return res.status(400).json({ error: "User ID is required" });

  try {
    const [result] = await pool.query(
      `UPDATE scalping_strategy SET 
        exch = ?, 
        stock_name = ?, 
        price_type = ?, 
        initial_buy_price = ?, 
        buy_on_market = ?, 
        target_price_diff = ?, 
        entry_diff_price = ?, 
        lot_size = ?, 
        max_open_position = ?, 
        duration = ?, 
        stop_loss = ?, 
        market_closing_time = ?, 
        debug_on = ? 
      WHERE user_id = ?`,
      [
        exch,
        stock_name,
        price_type,
        initial_buy_price,
        buy_on_market,
        target_price_diff,
        entry_diff_price,
        lot_size,
        max_open_position,
        duration,
        stop_loss,
        market_closing_time,
        debug_on,
        user_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Scalping details updated successfully" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Run Scalping Strategy Script (Dummy Implementation)
 */
router.post("/run-script", async (req, res) => {
  const { user_id, ...scalpingData } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, message: "User ID is required." });
  }

  try {
    console.log(`Executing scalping strategy for user_id: ${user_id}...`);
    res.json({ success: true, message: "Script executed successfully." });
  } catch (error) {
    console.error("Error running script:", error);
    res.status(500).json({ success: false, message: "Script execution failed." });
  }
});

/**
 * Update Scalping Settings
 */
router.post("/update-scalping", async (req, res) => {
  const { user_id, ...formData } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, message: "User ID is required." });
  }

  try {
    await pool.query("UPDATE scalping_strategy SET ? WHERE user_id = ?", [
      formData,
      user_id,
    ]);
    res.json({ success: true, message: "Scalping settings updated." });
  } catch (error) {
    console.error("Error updating scalping data:", error);
    res.status(500).json({ success: false, message: "Update failed." });
  }
});

module.exports = router;
