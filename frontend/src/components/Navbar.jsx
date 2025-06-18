import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaUserCircle } from "react-icons/fa";
import "../App.css";

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false); // New state for settings dropdown

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="navbar-container">
      <div className="logo">
        <Link to="/dashboard">
          <h1>Z Algo</h1>
        </Link>
      </div>
      <nav className="nav-items">
        <ul>
          {user ? (
            <li>
              <Link to="/dashboard">Dashboard</Link>
            </li>
          ) : (
            <li>
              <Link to="/">Home</Link>
            </li>
          )}

          <li
            className={`dropdown ${user ? "enabled" : "disabled"}`}
            onMouseEnter={() => user && setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <span>Strategy ▾</span>
            {dropdownOpen && user && (
              <ul className="dropdown-menu">
                <li>
                  <Link to="/scalping">Scalping Trading</Link>
                </li>
                <li>
                  <Link to="/circuit">Circuit Trading</Link>
                </li>
              </ul>
            )}
          </li>

          <li>
            <Link to="/about">About</Link>
          </li>
          <li>
            <Link to="/contact">Contact</Link>
          </li>

          {user ? (
            <li
              className="profile-dropdown"
              onMouseEnter={() => setProfileDropdownOpen(true)}
              onMouseLeave={() => setProfileDropdownOpen(false)}
            >
              <span className="profile-name">
                <FaUserCircle className="profile-icon" />{" "}
                {user.name ? user.name : "User"} ▾
              </span>
              {profileDropdownOpen && (
                <ul className="dropdown-menu">
                  <li>
                    <Link to="profile">Profile</Link>
                  </li>
                  {/* <li>Profile</li> */}
                  <li
                    className="settings-dropdown"
                    onMouseEnter={() => setSettingsDropdownOpen(true)}
                    onMouseLeave={() => setSettingsDropdownOpen(false)}
                  >
                    <span>Settings</span>
                    {settingsDropdownOpen && (
                      <ul className="dropdown-submenu">
                        <li>
                          <Link to="/settings/shoonya">Shoonya API</Link>
                        </li>
                        <li>
                          <Link to="/settings/zerodha">Zerodha API</Link>
                        </li>
                        <li>
                          <Link to="/settings/angel">Angel API</Link>
                        </li>
                      </ul>
                    )}
                  </li>
                  <li>
                    <Link to="/login" onClick={handleLogout}>
                      Logout
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          ) : (
            <li>
              <Link to="/login">Login</Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
};

export default Navbar;
