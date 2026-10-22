import { createRoot } from "react-dom/client";
import App from "./App";
import { createStore } from "./store";
import "./style.css";
// Access to localStorage can itself throw in restricted browser environments.
const store = createStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
createRoot(document.getElementById("root")!).render(<App store={store} />);
