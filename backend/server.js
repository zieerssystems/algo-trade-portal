process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./Routes/authRoutes");
const scalpingRoutes = require("./Routes/scalpingRoutes");
const shoonyaRoutes = require("./Routes/shoonyaRoutes");
const circuitRoutes = require("./Routes/circuitRoutes"); // ✅ Added

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;

// CORS for React frontend
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  exposedHeaders: ["Content-Type"]
}));

// Allow all headers + methods for SSE
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

app.use(express.json());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/scalping", scalpingRoutes);
app.use("/api/shoonya", shoonyaRoutes);
app.use("/api/circuit", circuitRoutes); // ✅ Circuit endpoints

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
