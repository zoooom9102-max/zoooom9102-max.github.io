import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SmoothScroll } from "./components/effects/SmoothScroll";
import "lenis/dist/lenis.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SmoothScroll />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
