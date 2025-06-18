import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaLock, FaEnvelope } from "react-icons/fa"; // Icons

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const result = await login(formData.email, formData.password);
    if (result.token) {
      setTimeout(() => navigate("/dashboard", { replace: true }), 100);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="page-container">
      <form onSubmit={handleSubmit} className="form-container">
        <h1>
          <FaLock style={{ marginRight: "10px", verticalAlign: "middle" }} />
          Login
        </h1>
        {error && <p style={{ color: "red" }}>{error}</p>}

        <div style={{ position: "relative", marginBottom: "15px" }}>
          <label htmlFor="email">Email:</label>
          <FaEnvelope
            style={{
              position: "absolute",
              top: "35px",
              left: "10px",
              color: "#888",
            }}
          />
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            onChange={handleChange}
            required
            style={{ paddingLeft: "35px" }}
          />
        </div>

        <div style={{ position: "relative", marginBottom: "15px" }}>
          <label htmlFor="password">Password:</label>
          <FaLock
            style={{
              position: "absolute",
              top: "35px",
              left: "10px",
              color: "#888",
            }}
          />
          <input
            type="password"
            id="password"
            placeholder="Enter your password"
            onChange={handleChange}
            required
            style={{ paddingLeft: "35px" }}
          />
        </div>

        <button type="submit" style={{ marginBottom: "10px" }}>
          Login
        </button>

        <p className="forgot-signup">
          <Link to="/forgot-password" className="forgot-link">
            Forgot Password?
          </Link>
          <Link to="/signup" className="signup-link">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
