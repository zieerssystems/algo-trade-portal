const { spawn } = require("child_process");
const path = require("path");

let runningProcess = null;
let sseClients = [];
let buffer = ""; // For handling partial stdout chunks

// ✅ Start circuit strategy script
const startCircuitScript = (req, res) => {
  const { circuit } = req.body;

  // Validate circuit name
  if (!circuit || !["Nifty 50", "Nifty 100"].includes(circuit)) {
    return res.status(400).json({ error: "Invalid circuit selected" });
  }

  // Prevent multiple instances
  if (runningProcess) {
    return res.status(400).json({ error: "Script already running" });
  }

  const scriptPath = path.join(__dirname, "../strategies/circuit_strategy.py");
  const python = spawn("python3", ["-u", scriptPath]);

  runningProcess = python;

  // ✅ Send JSON input to Python via stdin
  python.stdin.write(JSON.stringify({ circuit }));
  python.stdin.end();

  // ⏺️ Handle stdout logs
  python.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const json = JSON.parse(line);
        const tag = json.tag || "Log";
        const timestamp = json.timestamp;
        const time = timestamp ? new Date(timestamp).toLocaleTimeString() : "-";
        const summary =
          typeof json.data === "object"
            ? JSON.stringify(json.data, null, 2)
            : json.data || "";

        const logMessage = `✅ [${tag}] at ${time}\n${summary}`;

        console.log(logMessage);
        sseClients.forEach((client) => client.write(`data: ${logMessage}\n\n`));
      } catch (err) {
        // If line is not JSON
        console.error("❌ JSON parse error or plain log:", line);
        sseClients.forEach((client) => client.write(`data: ${line}\n\n`));
      }
    }

    buffer = lines[lines.length - 1]; // Store last (possibly incomplete) line
  });

  // 🔴 Handle stderr (errors)
  python.stderr.on("data", (data) => {
    const err = data.toString().trim();
    console.error(`[Circuit STDERR] ${err}`);
    sseClients.forEach((client) => client.write(`data: ❌ ${err}\n\n`));
  });

  // 🔚 On exit
  python.on("close", (code) => {
    console.log(`Circuit script exited with code ${code}`);
    runningProcess = null;
    sseClients.forEach((client) =>
      client.write(`data: ⛔ Script exited (code ${code})\n\n`)
    );
    sseClients.forEach((client) => client.end());
    sseClients = [];
    buffer = "";
  });

  res.json({ message: `Circuit script started for ${circuit}` });
};

// 🛑 Stop circuit strategy
const stopCircuitScript = (req, res) => {
  if (runningProcess) {
    runningProcess.kill();
    runningProcess = null;
    sseClients.forEach((client) =>
      client.write(`data: ⛔ Script stopped by user\n\n`)
    );
    sseClients.forEach((client) => client.end());
    sseClients = [];
    buffer = "";
    return res.json({ message: "Circuit script stopped" });
  } else {
    return res.status(400).json({ error: "No script running" });
  }
};

// 📡 Stream logs using SSE
const circuitLogStream = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(`data: 📡 Circuit script log streaming started...\n\n`);
  sseClients.push(res);

  req.on("close", () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
};

module.exports = {
  startCircuitScript,
  stopCircuitScript,
  circuitLogStream,
};

// const { spawn } = require("child_process");
// const path = require("path"); 
// let runningProcess = null;
// let sseClients = [];
// let buffer = "";
// let currentCircuit = null; // ✅ Track which circuit is running

// // ✅ Return current script status
// const getCircuitScriptStatus = (req, res) => {
//   if (runningProcess) {
//     return res.json({ running: true, circuit: currentCircuit });
//   } else {
//     return res.json({ running: false });
//   }
// };

// const startCircuitScript = (req, res) => {
//   const { circuit } = req.body;
//   if (!circuit || !["Nifty 50", "Nifty 100"].includes(circuit)) {
//     return res.status(400).json({ error: "Invalid circuit selected" });
//   }

//   if (runningProcess) {
//     return res.status(400).json({ error: "Script already running" });
//   }

//   const scriptPath = path.join(__dirname, "../strategies/circuit_strategy.py");
//   const python = spawn("python3", ["-u", scriptPath]);
//   runningProcess = python;
//   currentCircuit = circuit;

//   python.stdin.write(JSON.stringify({ circuit }));
//   python.stdin.end();

//   // ... rest of stdout/stderr handling remains the same ...

//   python.on("close", (code) => {
//     runningProcess = null;
//     currentCircuit = null; // ✅ Reset
//     sseClients.forEach((client) => client.write(`data: ⛔ Script exited (code ${code})\n\n`));
//     sseClients.forEach((client) => client.end());
//     sseClients = [];
//     buffer = "";
//   });

//   res.json({ message: `Circuit script started for ${circuit}` });
// };

// const stopCircuitScript = (req, res) => {
//   if (runningProcess) {
//     runningProcess.kill();
//     runningProcess = null;
//     currentCircuit = null;
//     sseClients.forEach((client) => client.write(`data: ⛔ Script stopped by user\n\n`));
//     sseClients.forEach((client) => client.end());
//     sseClients = [];
//     buffer = "";
//     return res.json({ message: "Circuit script stopped" });
//   } else {
//     return res.status(400).json({ error: "No script running" });
//   }
// };

// // 📡 Stream logs using SSE
// const circuitLogStream = (req, res) => {
//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   res.write(`data: 📡 Circuit script log streaming started...\n\n`);
//   sseClients.push(res);

//   req.on("close", () => {
//     sseClients = sseClients.filter((client) => client !== res);
//   });
// };


// module.exports = {
//   startCircuitScript,
//   stopCircuitScript,
//   circuitLogStream,
//   getCircuitScriptStatus, // ✅ Export status handler
// };
