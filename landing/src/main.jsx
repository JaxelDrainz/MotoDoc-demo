import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "@fontsource-variable/inter";
import { MotionEffects } from './MotionEffects.jsx';
import { PixelCards } from './PixelCards.jsx';

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <MotionEffects />
    <PixelCards />
  </React.StrictMode>,
);
