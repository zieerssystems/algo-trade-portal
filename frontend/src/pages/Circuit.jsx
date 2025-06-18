import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import "../App.css";

const circuitOptions = ["Nifty 50", "Nifty 100"];

const Circuit = () => {
  const [selectedCircuit, setSelectedCircuit] = useState(circuitOptions[0]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const eventSourceRef = useRef(null);

  const getToken = () => localStorage.getItem("token");

  const startCircuitScript = async () => {
    setLogs([`🚀 Starting ${selectedCircuit} script...`]);
    setLoading(true);

    try {
      const token = getToken();
      const response = await fetch("/api/circuit/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ circuit: selectedCircuit }),
      });

      if (!response.ok) {
        let errMessage = `Failed to start circuit script (status ${response.status})`;
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch (parseErr) {
          // If response is HTML (e.g. 404 page), this avoids crashing
          const text = await response.text();
          console.error("Non-JSON error response:", text);
        }
        throw new Error(errMessage);
      }

      // Start SSE stream
      eventSourceRef.current = new EventSource(
        `/api/circuit/logs?token=${token}`
      );

      eventSourceRef.current.onmessage = (e) => {
        setLogs((prev) => [...prev, e.data]);
      };

      eventSourceRef.current.onerror = () => {
        setLogs((prev) => [...prev, "❌ SSE connection lost."]);
        eventSourceRef.current?.close();
        setLoading(false);
      };
    } catch (err) {
      setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
      setLoading(false);
    }
  };

  const stopCircuitScript = async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/circuit/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to stop script");
      }

      // ✅ Clear logs and add stopped message
      setLogs(["🛑 Script stopped."]);
    } catch (err) {
      setLogs([`❌ Error stopping script: ${err.message}`]); // ✅ Also clear logs on error
    }

    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setLoading(false);
  };

  // On component unmount, clean up EventSource
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <div className="circuit-container">
      <h1 className="title">⚡ Circuit Trading</h1>

      <div>
        <h2 className="subtitle">📈 Select Circuit Type</h2>
        <div className="radio-group">
          {circuitOptions.map((option) => (
            <label key={option} className="radio-option">
              <span>{option}</span>
              <input
                type="radio"
                name="circuit"
                value={option}
                checked={selectedCircuit === option}
                onChange={() => setSelectedCircuit(option)}
                disabled={loading}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="button-group">
        <button
          className="start-button"
          onClick={startCircuitScript}
          disabled={loading}
        >
          {loading && <Loader2 className="loader" />}
          {loading ? "Running..." : "▶ Start Script"}
        </button>

        <button
          className="stop-button"
          onClick={stopCircuitScript}
          disabled={!loading}
        >
          ⛔ Stop
        </button>
      </div>

      <div>
        <h3 className="logs-title">📝 Logs:</h3>
        <div className="logs-box">
          {logs.length === 0 ? (
            <p className="no-logs">No logs yet.</p>
          ) : (
            logs.map((log, i) => <div key={i}>➤ {log}</div>)
          )}
        </div>
      </div>
    </div>
  );
};

export default Circuit;

// import { useState, useRef, useEffect } from "react";
// import { Loader2 } from "lucide-react";
// import "../App.css";

// const circuitOptions = ["Nifty 50", "Nifty 100"];

// const Circuit = () => {
//   const [selectedCircuit, setSelectedCircuit] = useState(circuitOptions[0]);
//   const [loading, setLoading] = useState(false);
//   const [logs, setLogs] = useState([]);
//   const eventSourceRef = useRef(null);

//   const getToken = () => localStorage.getItem("token");

//   // ✅ Fetch running state on load
//   useEffect(() => {
//     const token = getToken();
//     const fetchStatus = async () => {
//       try {
//         const res = await fetch("/api/circuit/status", {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const data = await res.json();
//         if (data.running) {
//           setSelectedCircuit(data.circuit);
//           setLoading(true);
//           setLogs([`🔄 Resuming ${data.circuit}...`]);

//           eventSourceRef.current = new EventSource(`/api/circuit/logs?token=${token}`);
//           eventSourceRef.current.onmessage = (e) => {
//             setLogs((prev) => [...prev, e.data]);
//           };
//           eventSourceRef.current.onerror = () => {
//             setLogs((prev) => [...prev, "❌ SSE connection lost."]);
//             eventSourceRef.current?.close();
//             setLoading(false);
//           };
//         }
//       } catch (err) {
//         console.error("Error checking circuit status:", err);
//       }
//     };

//     fetchStatus();

//     return () => {
//       eventSourceRef.current?.close();
//     };
//   }, []);

//   const startCircuitScript = async () => {
//     setLogs([`🚀 Starting ${selectedCircuit} script...`]);
//     setLoading(true);

//     try {
//       const token = getToken();
//       const response = await fetch("/api/circuit/start", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ circuit: selectedCircuit }),
//       });

//       if (!response.ok) {
//         let errMessage = `Failed to start circuit script (status ${response.status})`;
//         try {
//           const errData = await response.json();
//           errMessage = errData.error || errMessage;
//         } catch (parseErr) {
//           const text = await response.text();
//           console.error("Non-JSON error response:", text);
//         }
//         throw new Error(errMessage);
//       }

//       eventSourceRef.current = new EventSource(`/api/circuit/logs?token=${token}`);
//       eventSourceRef.current.onmessage = (e) => {
//         setLogs((prev) => [...prev, e.data]);
//       };
//       eventSourceRef.current.onerror = () => {
//         setLogs((prev) => [...prev, "❌ SSE connection lost."]);
//         eventSourceRef.current?.close();
//         setLoading(false);
//       };
//     } catch (err) {
//       setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
//       setLoading(false);
//     }
//   };

//   const stopCircuitScript = async () => {
//     try {
//       const token = getToken();
//       const response = await fetch("/api/circuit/stop", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!response.ok) {
//         const errData = await response.json();
//         throw new Error(errData.error || "Failed to stop script");
//       }

//       setLogs(["🛑 Script stopped."]);
//     } catch (err) {
//       setLogs([`❌ Error stopping script: ${err.message}`]);
//     }

//     eventSourceRef.current?.close();
//     eventSourceRef.current = null;
//     setLoading(false);
//   };

//   return (
//     <div className="circuit-container">
//       <h1 className="title">⚡ Circuit Trading</h1>

//       <div>
//         <h2 className="subtitle">📈 Select Circuit Type</h2>
//         <div className="radio-group">
//           {circuitOptions.map((option) => (
//             <label key={option} className="radio-option">
//               <span>{option}</span>
//               <input
//                 type="radio"
//                 name="circuit"
//                 value={option}
//                 checked={selectedCircuit === option}
//                 onChange={() => setSelectedCircuit(option)}
//                 disabled={loading}
//               />
//             </label>
//           ))}
//         </div>
//       </div>

//       <div className="button-group">
//         <button
//           className="start-button"
//           onClick={startCircuitScript}
//           disabled={loading}
//         >
//           {loading && <Loader2 className="loader" />}
//           {loading ? "Running..." : "▶ Start Script"}
//         </button>

//         <button
//           className="stop-button"
//           onClick={stopCircuitScript}
//           disabled={!loading}
//         >
//           ⛔ Stop
//         </button>
//       </div>

//       <div>
//         <h3 className="logs-title">📝 Logs:</h3>
//         <div className="logs-box">
//           {logs.length === 0 ? (
//             <p className="no-logs">No logs yet.</p>
//           ) : (
//             logs.map((log, i) => <div key={i}>➤ {log}</div>)
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Circuit;

