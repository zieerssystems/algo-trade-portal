const db = require("../config/db");

const saveShoonyaData = (userId, data, callback) => {
  const { token, user_code, password, vc, app_key, imei } = data;

  const query = `
    INSERT INTO shoonya_settings (user_id, token, user_code, password, vc, app_key, imei)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      token = ?,
      user_code = ?,
      password = ?,
      vc = ?,
      app_key = ?,
      imei = ?
  `;

  const values = [
    userId, token, user_code, password, vc, app_key, imei,
    token, user_code, password, vc, app_key, imei // For ON DUPLICATE KEY UPDATE
  ];

  db.query(query, values, callback);
};

const getShoonyaData = (userId, callback) => {
  const query = `
    SELECT token, user_code, password, vc, app_key, imei 
    FROM shoonya_settings 
    WHERE user_id = ?
  `;
  db.query(query, [userId], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

module.exports = {
  saveShoonyaData,
  getShoonyaData,
};
