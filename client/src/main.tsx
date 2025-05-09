import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Import the Vite HMR WebSocket connection fix for Replit environment
import "./vite-hmr-fix";

// Simplified to just render the App component without providers
// This allows us to isolate issues with the providers
createRoot(document.getElementById("root")!).render(<App />);
