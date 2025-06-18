const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, mobile, city } = req.body;

    // Check if all fields are provided
    if (!name || !email || !password || !mobile || !city) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Password Strength Validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          "Weak password. Must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // Check if email already exists
    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, mobile, city) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, mobile, city]
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const [users] = await pool.query(
      "SELECT id, name, email, password, mobile, city FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = users[0];


    const isMatch = await bcrypt.compare(password, user.password);



    if (!isMatch)
      return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token, user });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [user] = await pool.query(
      "SELECT id, name, email, mobile, city FROM users WHERE id = ?",
      [userId]
    );

    if (user.length === 0)
      return res.status(404).json({ error: "User not found" });

    res.status(200).json(user[0]);
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const { name, email, mobile, city, password } = req.body;
  const userId = req.user.id;

  console.log("🔹 Received Update Request for User:", userId);
  console.log("🔹 Received Data:", req.body);

  try {
    const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (user.length === 0) {
      console.log("❌ User Not Found in DB");
      return res.status(404).json({ message: "User not found" });
    }

    const updateValues = [
      name || user[0].name,
      email || user[0].email,
      mobile || user[0].mobile,
      city || user[0].city,
      password ? await bcrypt.hash(password, 10) : user[0].password,
      userId,
    ];

    console.log("🔹 Updating DB with:", updateValues);

    const updateQuery =
      "UPDATE users SET name = ?, email = ?, mobile = ?, city = ?, password = ? WHERE id = ?";
    const [result] = await pool.query(updateQuery, updateValues);

    console.log("🔹 Update Result:", result);

    if (result.affectedRows > 0) {
      console.log("✅ Profile Updated Successfully");
      return res.status(200).json({ message: "Profile updated successfully" });
    } else {
      console.log("⚠️ No Changes Detected");
      return res.status(400).json({ message: "No changes detected" });
    }
  } catch (error) {
    console.error("❌ Profile Update Error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to update profile. Please try again." });
  }
};
