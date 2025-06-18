const express = require("express");
const { registerUser, loginUser, getUserProfile, updateProfile} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/scalping",require("../models/scalpingStrategy"));
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, getUserProfile);
router.put("/profile", authMiddleware, updateProfile);

module.exports = router;
