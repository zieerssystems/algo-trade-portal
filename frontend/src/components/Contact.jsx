import { FaUser, FaEnvelope, FaCommentDots } from "react-icons/fa";

const Contact = () => {
  return (
    <div className="page-container">
      <form className="form-container">
        <h1>
          <FaCommentDots style={{ marginRight: "10px", verticalAlign: "middle" }} />
          Contact Us
        </h1>

        <div style={{ position: "relative", marginBottom: "15px" }}>
          <label htmlFor="name">Name:</label>
          <FaUser
            style={{
              position: "absolute",
              top: "35px",
              left: "10px",
              color: "#888",
            }}
          />
          <input
            type="text"
            id="name"
            placeholder="Enter your name"
            required
            style={{ paddingLeft: "35px" }}
          />
        </div>

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
            required
            style={{ paddingLeft: "35px" }}
          />
        </div>

        <div style={{ position: "relative", marginBottom: "15px" }}>
          <label htmlFor="msg">Message:</label>
          <FaCommentDots
            style={{
              position: "absolute",
              top: "40px",
              left: "10px",
              color: "#888",
            }}
          />
          <textarea
            id="msg"
            placeholder="Enter your message"
            required
            style={{ paddingLeft: "35px", paddingTop: "10px" }}
          />
        </div>

        <button type="submit" className="contact-btn">
          Send
        </button>
      </form>
    </div>
  );
};

export default Contact;
