const db = require("../config/db");

const saveShoonyaDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, user_code, password, vc, app_key, imei } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // console.log("Shoonya Save Triggered for user:", userId);

    const [results] = await db.query(
      "SELECT * FROM shoonya_settings WHERE user_id = ?",
      [userId]
    );

    if (results.length > 0) {
      // Update existing record
      await db.query(
        `UPDATE shoonya_settings 
         SET token = ?, user_code = ?, password = ?, vc = ?, app_key = ?, imei = ?
         WHERE user_id = ?`,
        [token, user_code, password, vc, app_key, imei, userId]
      );
      console.log("Shoonya settings updated");
      return res.status(200).json({ message: "Shoonya settings updated" });
    } else {
      // Insert new record
      await db.query(
        `INSERT INTO shoonya_settings 
         (user_id, token, user_code, password, vc, app_key, imei)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, token, user_code, password, vc, app_key, imei]
      );
      console.log("Shoonya settings saved");
      return res.status(201).json({ message: "Shoonya settings saved" });
    }
  } catch (error) {
    console.error("Shoonya Save Error:", error.message, error.stack);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getShoonyaDetails = async (req, res) => {
    try {
      const userId = req.user?.id;
    //   console.log("Fetching Shoonya for user:", userId);
  
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
      const [results] = await db.query(
        `SELECT token, user_code, password, vc, app_key, imei 
         FROM shoonya_settings WHERE user_id = ?`,
        [userId]
      );
  
    //   console.log("Shoonya DB results:", results);
  
      if (results.length === 0) return res.status(200).json({}); // No data
      return res.status(200).json(results[0]);
    } catch (error) {
        console.error("Shoonya Fetch Error:", error.message, error.stack);
      return res.status(500).json({ message: "Failed to fetch data" });
    }
  };
  

module.exports = { saveShoonyaDetails, getShoonyaDetails };
