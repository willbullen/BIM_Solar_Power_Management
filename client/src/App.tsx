import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Route, Switch } from "wouter";
import { AuthProvider } from "@/hooks/use-auth";
import { PowerDataProvider } from "@/hooks/use-power-data";
import { ProtectedRoute, AdminRoute } from "@/lib/protected-route";
import DashboardPage from "@/pages/dashboard-page";
import AuthPage from "@/pages/auth-page";
import SettingsPage from "@/pages/settings-page";
import ReportsPage from "@/pages/reports-page";
import ForecastingPage from "@/pages/forecasting-page";
import EquipmentPage from "@/pages/equipment-page";
import OperationalPlanningPage from "@/pages/operational-planning-page";
import FeedbackPage from "@/pages/feedback-page";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PowerDataProvider>
          <Switch>
            <ProtectedRoute path="/" component={DashboardPage} />
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/reports" component={ReportsPage} />
            <ProtectedRoute path="/forecasting" component={ForecastingPage} />
            <ProtectedRoute path="/equipment" component={EquipmentPage} />
            <ProtectedRoute path="/planning" component={OperationalPlanningPage} />
            <ProtectedRoute path="/feedback" component={FeedbackPage} />
            <AdminRoute path="/settings" component={SettingsPage} />
            <Route path="/auth" component={AuthPage} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </PowerDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
