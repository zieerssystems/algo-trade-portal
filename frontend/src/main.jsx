import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // ✅ Import BrowserRouter
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>  {/* ✅ Wrap the entire app inside BrowserRouter */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
