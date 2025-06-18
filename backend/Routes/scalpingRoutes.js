const express = require("express");
const router = express.Router();
const {
  runScalpingStrategyWithData,
  stopScalpingScript,
  getAllStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy
} = require("../controllers/scalpingController");
const authenticateToken = require("../middleware/authMiddleware");

router.get("/start/:id", runScalpingStrategyWithData); // ✅ Use POST for starting the strategy
router.post("/stop-script", authenticateToken, stopScalpingScript);
router.get("/all", authenticateToken, getAllStrategies);
router.post("/", authenticateToken, createStrategy);
router.put("/:id", authenticateToken, updateStrategy);
router.delete("/:id", authenticateToken, deleteStrategy);

module.exports = router;
