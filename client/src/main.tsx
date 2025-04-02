import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "@/hooks/use-auth";
import { PowerDataProvider } from "@/hooks/use-power-data";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <PowerDataProvider>
      <App />
    </PowerDataProvider>
  </AuthProvider>
);
