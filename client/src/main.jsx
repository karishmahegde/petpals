import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles/index.css";

const queryClient = new QueryClient(); // This object holds your data while the tab is open

ReactDOM.createRoot(document.getElementById("root")).render(
  //This finds the <div id="root"> in index.html and tells React to take control of it.
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {" "}
      //makes TanStack Query available to every component in the app
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>, //a development-only wrapper that highlights potential problems by running certain checks twice
);
