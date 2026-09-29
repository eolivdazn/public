import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { SITE_ENV_LABEL } from "./lib/siteEnv.js";

if (SITE_ENV_LABEL) {
  document.title = `[${SITE_ENV_LABEL}] ${document.title}`;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

