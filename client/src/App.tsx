import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouterProvider, Router, Route, ProtectedRoute } from "./lib/router";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { MappingConfigPage } from "@/pages/mapping-config";

function AppRouter() {
  return (
    <Router>
      <Route path="/" component={LoginPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/profile" component={Profile} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/mapping-config" component={MappingConfigPage} />
      <ProtectedRoute path="/admin" component={Admin} adminOnly />
      <Route path="*" component={NotFound} />
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </RouterProvider>
    </QueryClientProvider>
  );
}

export default App;
