import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Default theme attribute before first paint.
document.documentElement.setAttribute("data-theme", localStorage.getItem("yn_admin_theme") || "light");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
