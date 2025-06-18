const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware"); // path depends on your folder structure

const {
  startCircuitScript,
  stopCircuitScript,
  circuitLogStream,
} = require("../controllers/circuitController");

// 🛡️ Protected routes using JWT    
router.post("/start", authenticateToken, startCircuitScript);
router.post("/stop", authenticateToken, stopCircuitScript);
router.get("/logs", authenticateToken, circuitLogStream);

module.exports = router;
