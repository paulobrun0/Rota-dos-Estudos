import React from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./auth/AuthGate.jsx";
import {LearningPreview} from "./views/LearningPreview.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("preview") === "learning" ? <LearningPreview /> : <AuthGate />}
  </React.StrictMode>,
);
