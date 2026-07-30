import React from "react";
import ReactDOM from "react-dom/client";
import { PortfolioPage } from "../app/PortfolioPage";
import "../app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PortfolioPage />
  </React.StrictMode>,
);

