import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const Scalping = () => {
  const { user } = useAuth();
  const [userId, setUserId] = useState(
    user?.id || localStorage.getItem("userId")
  );
  const [formData, setFormData] = useState({
    exch: "",
    StocksName: "",
    price_type: "",
    initialBuyPrice: "",
    buyOnMarket: "",
    targetPriceDiff: "",
    entryDiffPrice: "",
    lotSize: "",
    maxOpenPosition: "",
    duration: "",
    stopLoss: "",
    marketClosingTime: "",
    debugOn: "",
  });
  const [runningScripts, setRunningScripts] = useState({});
  const [eventSrc, setEventSrc] = useState(null);
  const [records, setRecords] = useState([]);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [scriptOutput, setScriptOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textAreaRef = useRef(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
      localStorage.setItem("userId", user.id);
    } else {
      setUserId(localStorage.getItem("userId"));
    }
  }, [user]);

  useEffect(() => {
    if (userId) fetchAllRecords();
  }, [userId]);

  const fetchAllRecords = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5001/api/scalping/all?user_id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setRecords(res.data);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("Authentication token not found.");
      setIsLoading(false);
      return;
    }

    try {
      const url = currentRecordId
        ? `http://localhost:5001/api/scalping/${currentRecordId}`
        : "http://localhost:5001/api/scalping/";
      const method = currentRecordId ? "put" : "post";

      await axios[method](
        url,
        {
          ...formData,
          user_id: userId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchAllRecords();
      resetForm();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRecord = (record) => {
    setFormData({
      ...record,
      buyOnMarket: record.buyOnMarket === 1 ? "Yes" : "No",
      debugOn: record.debugOn.toString(),
    });
    setCurrentRecordId(record.id);
    setIsEditing(true);
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Are you sure you want to delete this strategy?"))
      return;
    setIsLoading(true);
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("Authentication token not found.");
      setIsLoading(false);
      return;
    }

    try {
      await axios.delete(
        `http://localhost:5001/api/scalping/${id}?user_id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await fetchAllRecords();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewRecord = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleCancel = () => {
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      exch: "",
      StocksName: "",
      price_type: "",
      initialBuyPrice: "",
      buyOnMarket: "",
      targetPriceDiff: "",
      entryDiffPrice: "",
      lotSize: "",
      maxOpenPosition: "",
      duration: "",
      stopLoss: "",
      marketClosingTime: "",
      debugOn: "",
    });
    setCurrentRecordId(null);
    setIsEditing(false);
  };

  const startScalping = async (strategyId) => {
    try {
      setRunningScripts((prev) => ({ ...prev, [strategyId]: true }));

      const eventSource = new EventSource(
        `http://localhost:5001/api/scalping/start/${strategyId}`
      );
      setEventSrc(eventSource);

      eventSource.onmessage = (event) => {
        const newLine = event.data;
        setScriptOutput((prev) => prev + "\n" + newLine);
      };

      eventSource.onerror = (err) => {
        console.error("SSE error details:", err);
        setRunningScripts((prev) => ({ ...prev, [strategyId]: false }));
        eventSource.close();
      };
    } catch (err) {
      console.error("Error starting strategy:", err);
      setRunningScripts((prev) => ({ ...prev, [strategyId]: false }));
    }
  };

  const handleStopScript = async (strategyId) => {
    const token = localStorage.getItem("token");

    try {
      await fetch("http://localhost:5001/api/scalping/stop-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ strategyId }),
      });

      setScriptOutput("");

      setRunningScripts((prev) => ({ ...prev, [strategyId]: false }));
      if (eventSrc) {
        eventSrc.close();
      }
    } catch (err) {
      console.error("Error stopping strategy:", err);
    }
  };

  const handleClearOutput = () => setScriptOutput("");

  return (
    <div className="scalping-container">
      <h1 className="heading">Scalping Details</h1>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="StocksName">Stock Name:</label>
            <input
              type="text"
              id="StocksName"
              name="StocksName"
              value={formData.StocksName}
              placeholder="Stock Name"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="exch">Exchange:</label>
            <select
              id="exch"
              name="exch"
              value={formData.exch}
              onChange={handleChange}
              disabled={!isEditing}
              required
            >
              <option value="">Select Exchange</option>
              <option value="NSE">NSE</option>
              <option value="NFO">NFO</option>
              <option value="BSE">BSE</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="price_type">Price Type:</label>
            <select
              id="price_type"
              name="price_type"
              value={formData.price_type}
              onChange={handleChange}
              disabled={!isEditing}
              required
            >
              <option value="">Select Price Type</option>
              <option value="MKT">MKT</option>
              <option value="LMT">LMT</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="initialBuyPrice">Initial Buy Price:</label>
            <input
              type="number"
              id="initialBuyPrice"
              name="initialBuyPrice"
              value={formData.initialBuyPrice}
              placeholder="Initial Buy Price"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="targetPriceDiff">Target Price Diff (₹):</label>
            <input
              type="number"
              id="targetPriceDiff"
              name="targetPriceDiff"
              value={formData.targetPriceDiff}
              placeholder="Target Price Diff"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="entryDiffPrice">Entry Diff Price (₹):</label>
            <input
              type="number"
              id="entryDiffPrice"
              name="entryDiffPrice"
              value={formData.entryDiffPrice}
              placeholder="Entry Diff Price"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lotSize">Lot Size:</label>
            <input
              type="number"
              id="lotSize"
              name="lotSize"
              value={formData.lotSize}
              placeholder="Lot Size"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="maxOpenPosition">Max Open Position:</label>
            <input
              type="number"
              id="maxOpenPosition"
              name="maxOpenPosition"
              value={formData.maxOpenPosition}
              placeholder="Max Open Position"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="duration">Duration (min):</label>
            <input
              type="number"
              id="duration"
              name="duration"
              value={formData.duration}
              placeholder="Duration"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stopLoss">Stop Loss:</label>
            <input
              type="number"
              id="stopLoss"
              name="stopLoss"
              value={formData.stopLoss}
              placeholder="Stop Loss"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="marketClosingTime">Market Closing Time:</label>
            <input
              type="time"
              id="marketClosingTime"
              name="marketClosingTime"
              value={formData.marketClosingTime}
              placeholder="HH:MM"
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="debugOn">Debug Mode:</label>
            <select
              id="debugOn"
              name="debugOn"
              value={formData.debugOn}
              onChange={handleChange}
              disabled={!isEditing}
              required
            >
              <option value="">Select Debug Mode</option>
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          {isEditing ? (
            <>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading
                  ? "Processing..."
                  : currentRecordId
                  ? "Update"
                  : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleNewRecord}
              className="btn btn-primary"
            >
              Add
            </button>
          )}
        </div>
      </form>

      <div className="output-section">
        <div className="output-header">
          <button
            type="button"
            onClick={handleClearOutput}
            className="btn btn-secondary btn-sm"
          >
            Clear
          </button>
          <h4>📝 Logs:</h4>
        </div>
        <textarea
          className="output-console"
          value={scriptOutput}
          readOnly
          ref={textAreaRef}
          placeholder="Script output will appear here..."
        />
      </div>

      <div className="records-section">
        <div className="section-header">
          <h2>Saved Strategies</h2>
          {isLoading && <div className="loading-indicator">Loading...</div>}
        </div>

        {records.length > 0 ? (
          <div className="table-responsive">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Exchange</th>
                  <th>Price Type</th>
                  <th>Buy Price</th>
                  <th>Target Diff</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.StocksName}</td>
                    <td>{record.exch}</td>
                    <td>{record.price_type}</td>
                    <td>{record.initialBuyPrice}</td>
                    <td>{record.targetPriceDiff}</td>
                    <td className="actions">
                      <button
                        onClick={() => handleEditRecord(record)}
                        className="btn btn-sm btn-edit"
                        disabled={isLoading}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(record.id)}
                        className="btn btn-sm btn-delete"
                        disabled={isLoading}
                      >
                        Delete
                      </button>
                      {!runningScripts[record.id] ? (
                        <button
                          onClick={() => startScalping(record.id)}
                          className="btn btn-sm btn-success"
                          disabled={isLoading}
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStopScript(record.id)}
                          className="btn btn-sm btn-danger"
                          disabled={isLoading}
                        >
                          Stop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-records">
            <p>No strategies found</p>
            <button onClick={handleNewRecord} className="btn btn-primary">
              Create New Strategy
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scalping;


