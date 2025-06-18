import { useState, useEffect } from "react";
import { FaEdit, FaSave, FaUser, FaEnvelope, FaPhone, FaCity } from "react-icons/fa";
import { useAuth } from "../context/AuthContext"; // ✅ Import Auth Context

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    city: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(user);
      setLoading(false);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No token found. Please log in again.");
        return;
      }

      const response = await fetch("http://localhost:5001/api/auth/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Update failed! Status: ${response.status}`);
      }

      updateUser(formData);
      setError(null);
      setIsEditing(false);
    } catch (error) {
      setError("Failed to update profile. Please try again.");
    }
  };

  const fieldIcons = {
    name: <FaUser className="me-2" />,
    email: <FaEnvelope className="me-2" />,
    mobile: <FaPhone className="me-2" />,
    city: <FaCity className="me-2" />,
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="container mt-5">
      <h3 className="mb-4">User Profile</h3>
      <br />
      {error && <div className="alert alert-danger">{error}</div>}

      <form>
        {["name", "email", "mobile", "city"].map((field) => (
          <div className="mb-3" key={field}>
            <label htmlFor={field} className="form-label">
              {fieldIcons[field]}
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              type="text"
              className="form-control"
              id={field}
              name={field}
              value={formData[field] || ""}
              onChange={handleChange}
              disabled={field === "email" || !isEditing}
            />
          </div>
        ))}
      </form>

      <button
        type="button"
        className={`btn ${isEditing ? "btn-success" : "btn-primary"} mt-3`}
        onClick={isEditing ? handleSave : () => setIsEditing(true)}
      >
        {isEditing ? <FaSave className="me-1" /> : <FaEdit className="me-1" />}
        {isEditing ? "Save" : "Edit"}
      </button>
    </div>
  );
};

export default Profile;
