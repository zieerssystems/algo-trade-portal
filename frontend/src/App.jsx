import { Route, Routes } from "react-router-dom";
import "./App.css";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import About from "./components/About";
import Home from "./components/Home";
import Profile from "./components/profile";
import Contact from "./components/Contact";
import Dashboard from "./components/Dashboard";
import Scalping from "./pages/Scalping";
import Signup from "./components/signup";
import Shoonya from "./components/Shoonya";
import Circuit from "./pages/Circuit";
import Footer from "./components/Footer";

const App = () => {
  return (
    <>
      <Navbar />
      <div className="body-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scalping" element={<Scalping />} />
          <Route path="/circuit" element={<Circuit />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings/shoonya" element={<Shoonya />} />
        </Routes>
      </div>
      <Footer />
    </>
  );
};

export default App;
