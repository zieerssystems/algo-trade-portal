import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaEnvelope,
  FaLock,
  FaUser,
  FaPhone,
  FaMapMarkerAlt,
  FaUserPlus,
} from "react-icons/fa";

const Signup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
    city: "",
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const validateForm = () => {
    let newErrors = {};

    if (!formData.name.trim() || formData.name.length < 3) {
      newErrors.name = "Name must be at least 3 characters long";
    }

    if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters and spaces";
    }

    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address";
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

    if (!passwordRegex.test(formData.password)) {
      newErrors.password =
        "Password must be at least 12 characters long and include at least 1 uppercase, 1 lowercase, 1 number, and 1 special character (@$!%*?&)";
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!/^\d{10}$/.test(formData.mobile)) {
      newErrors.mobile = "Mobile number must be exactly 10 digits";
    }

    if (!formData.city.trim() || formData.city.length < 2) {
      newErrors.city = "City must be at least 2 characters long";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(null);

    if (!validateForm()) return;

    try {
      const response = await fetch("http://localhost:5001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          mobile: formData.mobile,
          city: formData.city,
        }),
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (response.ok) {
        setSuccessMessage(data.message || "Signup successful!");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setErrors({ general: data.error || "Signup failed" });
      }
    } catch (err) {
      setErrors({ general: "Something went wrong. Please try again." });
      console.error("Signup Error:", err);
    }
  };

  const inputWrapperStyle = {
    position: "relative",
    marginBottom: "15px",
  };

  const iconStyle = {
    position: "absolute",
    top: "35px",
    left: "10px",
    color: "#888",
  };

  const inputStyle = {
    paddingLeft: "35px",
  };

  return (
    <div className="page-container">
      <form onSubmit={handleSubmit} className="form-container">
        <h1>
          <FaUserPlus style={{ marginRight: "10px", color: "#555" }} />
          Sign Up
        </h1>

        {errors.general && <p style={{ color: "red" }}>{errors.general}</p>}
        {successMessage && <p style={{ color: "green" }}>{successMessage}</p>}

        <div style={inputWrapperStyle}>
          <label htmlFor="name">Name:</label>
          <FaUser style={iconStyle} />
          <input
            type="text"
            id="name"
            placeholder="Enter your name"
            value={formData.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          {errors.name && <p style={{ color: "red" }}>{errors.name}</p>}
        </div>

        <div style={inputWrapperStyle}>
          <label htmlFor="email">Email:</label>
          <FaEnvelope style={iconStyle} />
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          {errors.email && <p style={{ color: "red" }}>{errors.email}</p>}
        </div>

        <div style={inputWrapperStyle}>
          <label htmlFor="password">Password:</label>
          <FaLock style={iconStyle} />
          <input
            type="password"
            id="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          {errors.password && <p style={{ color: "red" }}>{errors.password}</p>}
        </div>

        <div style={inputWrapperStyle}>
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <FaLock style={iconStyle} />
          <input
            type="password"
            id="confirmPassword"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          {errors.confirmPassword && (
            <p style={{ color: "red" }}>{errors.confirmPassword}</p>
          )}
        </div>

        <div style={inputWrapperStyle}>
          <label htmlFor="mobile">Mobile:</label>
          <FaPhone style={iconStyle} />
          <input
            type="number"
            id="mobile"
            placeholder="Enter your mobile number"
            value={formData.mobile}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          {errors.mobile && <p style={{ color: "red" }}>{errors.mobile}</p>}
        </div>

        <div style={inputWrapperStyle}>
          <label htmlFor="city">City:</label>
          <FaMapMarkerAlt style={iconStyle} />
          <input
            type="text"
            id="city"
            placeholder="Enter your city"
            value={formData.city}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          {errors.city && <p style={{ color: "red" }}>{errors.city}</p>}
        </div>

        <button type="submit">Sign Up</button>

        <p>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </div>
  );
};

export default Signup;
