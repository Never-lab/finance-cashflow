/**
 * Punto di ingresso dell'app web Cash Flow: monta React sull'elemento `#root`
 * e avvolge l'albero in StrictMode (doppio render in dev per individuare effetti impuri).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
