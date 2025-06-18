import React, { useEffect, useState } from "react";
import {
  FaUserLock,
  FaUser,
  FaKey,
  FaShieldAlt,
  FaMobileAlt,
  FaSave,
  FaEdit,
  FaTimes,
} from "react-icons/fa";

const Shoonya = () => {
  const [formData, setFormData] = useState({
    token: "",
    user_code: "",
    password: "",
    vc: "",
    app_key: "",
    imei: "",
  });

  const [editMode, setEditMode] = useState(false);

  const fetchShoonyaData = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5001/api/shoonya", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data) {
        setFormData({
          token: data.token || "",
          user_code: data.user_code || "",
          password: data.password || "",
          vc: data.vc || "",
          app_key: data.app_key || "",
          imei: data.imei || "",
        });
        setEditMode(false); // default to read-only mode
      }
    } catch (error) {
      console.error("Failed to fetch Shoonya data:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5001/api/shoonya", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      console.log(result.message);

      fetchShoonyaData(); // Refresh form data
    } catch (error) {
      console.error("Error saving Shoonya data:", error);
    }
  };

  useEffect(() => {
    fetchShoonyaData();
  }, []);

  const fieldIcons = {
    token: <FaUserLock className="me-2" />,
    user_code: <FaUser className="me-2" />,
    password: <FaKey className="me-2" />,
    vc: <FaShieldAlt className="me-2" />,
    app_key: <FaKey className="me-2" />,
    imei: <FaMobileAlt className="me-2" />,
  };

  return (
    <div className="container mt-5">
      <h3>Shoonya API Credentials</h3>
      <br />
      <form onSubmit={handleSubmit}>
        {["token", "user_code", "password", "vc", "app_key", "imei"].map((field) => (
          <div className="mb-3" key={field}>
            <label className="form-label text-capitalize">
              {fieldIcons[field]}
              {field.replace("_", " ")}
            </label>
            <input
              type="text"
              className="form-control"
              name={field}
              value={formData[field]}
              onChange={handleChange}
              readOnly={!editMode}
            />
          </div>
        ))}

        <div className="d-flex gap-2">
          {!editMode && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditMode(true)}
            >
              <FaEdit className="me-1" />
              Edit
            </button>
          )}
          {editMode && (
            <>
              <button type="submit" className="btn btn-success">
                <FaSave className="me-1" />
                Save
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fetchShoonyaData()}
              >
                <FaTimes className="me-1" />
                Cancel
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default Shoonya;
