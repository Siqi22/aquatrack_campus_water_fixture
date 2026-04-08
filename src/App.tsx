import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CampusNavigator from "./pages/CampusNavigator";
import AddAsset from "./pages/AddAsset";
import ManageAssets from "./pages/ManageAssets";
import FixtureDetail from "./pages/FixtureDetail";
import Maintenance from "./pages/Maintenance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campus" element={<CampusNavigator />} />
            <Route path="/add" element={<AddAsset />} />
            <Route path="/manage" element={<ManageAssets />} />
            <Route path="/fixture/:id" element={<FixtureDetail />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
