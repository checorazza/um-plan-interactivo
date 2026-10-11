import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App.tsx";
import { GOOGLE_CLIENT_ID } from "./api/cliente";
import "./index.css";

const app = <App />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Sin client id la app funciona igual, sólo que sin botón de login: el
        provider de Google no se monta para no cargar su script al pedo. */}
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider>
    ) : (
      app
    )}
  </StrictMode>,
);
