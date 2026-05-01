// Import CSS first
import "./index.css";

import { createRoot } from "react-dom/client";
import App from "./App";

// A-Frame is already loaded via script tag in index.html
// No need to import it here to avoid conflicts

// Create root and render app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
