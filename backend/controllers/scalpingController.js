const { spawn } = require("child_process");
const path = require("path");
const pool = require("../config/db");

const runningProcesses = new Map();

const getAllStrategies = async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "User ID is required" });

  try {
    const [records] = await pool.query(
      "SELECT * FROM scalping_strategy WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const createStrategy = async (req, res) => {
  const {
    exch,
    StocksName,
    price_type,
    initialBuyPrice,
    buyOnMarket = "No",
    targetPriceDiff,
    entryDiffPrice,
    lotSize,
    maxOpenPosition = 1,
    duration = 300,
    stopLoss = 0,
    marketClosingTime = "15:30",
    debugOn = 0,
    user_id,
  } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO scalping_strategy
      (user_id, exch, StocksName, price_type, initialBuyPrice, buyOnMarket,
      targetPriceDiff, entryDiffPrice, lotSize, maxOpenPosition, duration, stopLoss,
      marketClosingTime, debugOn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        exch,
        StocksName,
        price_type,
        initialBuyPrice,
        buyOnMarket === "Yes" ? 1 : 0,
        targetPriceDiff,
        entryDiffPrice,
        lotSize,
        maxOpenPosition,
        duration,
        stopLoss,
        marketClosingTime,
        debugOn,
      ]
    );

    res.status(201).json({ message: "Strategy created", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create strategy" });
  }
};

const updateStrategy = async (req, res) => {
  const { id } = req.params;
  const {
    exch,
    StocksName,
    price_type,
    initialBuyPrice,
    buyOnMarket,
    targetPriceDiff,
    entryDiffPrice,
    lotSize,
    maxOpenPosition,
    duration,
    stopLoss,
    marketClosingTime,
    debugOn,
    user_id,
  } = req.body;

  try {
    const [existing] = await pool.query(
      "SELECT id FROM scalping_strategy WHERE id = ? AND user_id = ?",
      [id, user_id]
    );
    if (existing.length === 0)
      return res.status(404).json({ error: "Strategy not found" });

    await pool.query(
      `UPDATE scalping_strategy SET
        exch = ?, StocksName = ?, price_type = ?, initialBuyPrice = ?, buyOnMarket = ?,
        targetPriceDiff = ?, entryDiffPrice = ?, lotSize = ?, maxOpenPosition = ?,
        duration = ?, stopLoss = ?, marketClosingTime = ?, debugOn = ?
        WHERE id = ?`,
      [
        exch,
        StocksName,
        price_type,
        initialBuyPrice,
        buyOnMarket === "Yes" ? 1 : 0,
        targetPriceDiff,
        entryDiffPrice,
        lotSize,
        maxOpenPosition,
        duration,
        stopLoss,
        marketClosingTime,
        debugOn,
        id,
      ]
    );

    res.json({ message: "Strategy updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update strategy" });
  }
};

// In scalpingController.js -> deleteStrategy (Example)
const deleteStrategy = async (req, res) => {
  const { id } = req.params;
  const authenticatedUserId = req.user.id; // Assuming middleware adds user object with id

  try {
    // Fetch the strategy and check if its user_id matches the authenticated user
    const [existing] = await pool.query(
      "SELECT id, user_id FROM scalping_strategy WHERE id = ?",
      [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ error: "Strategy not found" });

    if (existing[0].user_id !== authenticatedUserId) {
      // Forbidden - User doesn't own this strategy
      return res
        .status(403)
        .json({ error: "Forbidden: You do not own this strategy" });
    }

    // Proceed with deletion if ownership is verified
    await pool.query("DELETE FROM scalping_strategy WHERE id = ?", [id]);
    res.json({ message: "Strategy deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete strategy" });
  }
};

// Endpoint to trigger scalping strategy
const runScalpingStrategyWithData = async (req, res) => {
  const strategyId = req.params.id;
  console.log(`Starting scalping strategy with ID: ${strategyId}`);

  try {
    // Fetch strategy details from DB
    const [strategyResult] = await pool.query(
      "SELECT * FROM scalping_strategy WHERE id = ?",
      [strategyId]
    );

    if (strategyResult.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const strategy = strategyResult[0];

    // Fetch Shoonya credentials from DB
    const [shoonyaResult] = await pool.query(
      "SELECT user_id, user_code, password, vc, app_key, imei, token FROM shoonya_settings WHERE user_id = ?",
      [strategy.user_id]
    );

    if (shoonyaResult.length === 0) {
      return res
        .status(400)
        .json({ error: "Shoonya credentials not found for user" });
    }

    const creds = shoonyaResult[0];
    console.log("Shoonya Token:", creds.token);

    const scriptPath = path.join(
      __dirname,
      "../strategies/scalping_strategy.py"
    );

    const args = [scriptPath];
    const python = spawn("python3", ["-u", ...args]);

    python.stdin.write(
      JSON.stringify({
        token: creds.token,
        user: creds.user_code,
        password: creds.password,
        vc: creds.vc,
        app_key: creds.app_key,
        imei: creds.imei,
        exch: strategy.exch,
        stock_name: strategy.StocksName,
        price_type: strategy.price_type,
        initial_buy_price: strategy.initialBuyPrice,
        target_price_diff: strategy.targetPriceDiff,
        entry_diff_price: strategy.entryDiffPrice,
        lot_size: strategy.lotSize,
        max_open_position: strategy.maxOpenPosition,
        duration: strategy.duration,
        market_closing_time: strategy.marketClosingTime,
        debug_on: strategy.debugOn === 1 ? "True" : "False",
      })
    );
    python.stdin.end();

    // Setup SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    // Keep-alive ping every 15 seconds
    const keepAliveInterval = setInterval(() => {
      res.write(":\n\n"); // SSE ping
    }, 15000);

    // Handle Python stdout
    python.stdout.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        console.log(line);
        res.write(`data: ${line}\n\n`);
      }
    });

    // Handle Python stderr
    python.stderr.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        console.error("Python stderr:", line);
        res.write(`data: [ERROR] ${line}\n\n`);
      }
    });

    // When the Python script exits
    python.on("close", (code) => {
      clearInterval(keepAliveInterval);
      res.write(`data: Script exited with code ${code}\n\n`);
      res.end();
    });

    // If client disconnects
    req.on("close", () => {
      clearInterval(keepAliveInterval);
      python.kill();
      console.log(`Client disconnected. Stopping strategy ${strategyId}`);
    });
  } catch (err) {
    console.error(err);
    if (res.headersSent) {
      res.write(`data: [ERROR] ${err.message}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to start strategy" });
    }
  }
};

const stopScalpingScript = async (req, res) => {
  const { strategyId } = req.body;
  console.log("Stop request body:", req.body);

  if (!strategyId) {
    return res.status(400).json({ error: "strategyId is required" });
  }

  const processToKill = runningProcesses.get(String(strategyId));
  if (!processToKill) {
    // ✅ Respond gracefully if script already stopped
    return res.status(200).json({ message: "Script already stopped" });
  }

  processToKill.kill();
  runningProcesses.delete(strategyId);

  res.json({ message: `Strategy ${strategyId} stopped successfully` });
};

// console.log("Stop request body:", req.body);

module.exports = {
  getAllStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  runScalpingStrategyWithData,
  stopScalpingScript,
};
