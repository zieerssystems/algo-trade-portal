const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  saveShoonyaDetails,
  getShoonyaDetails,
} = require("../controllers/shoonyaController");

router.get("/", authMiddleware, getShoonyaDetails);
router.post("/", authMiddleware, saveShoonyaDetails);
router.put("/", authMiddleware, saveShoonyaDetails);

module.exports = router;
