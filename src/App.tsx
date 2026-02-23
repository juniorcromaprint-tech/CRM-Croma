import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Jobs from "./pages/Jobs";
import Stores from "./pages/Stores";
import JobDetail from "./pages/JobDetail";
import NewJob from "./pages/NewJob";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<NewJob />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/stores" element={<Stores />} />
          </Routes>
        </Layout>
      </Router>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

export default App;