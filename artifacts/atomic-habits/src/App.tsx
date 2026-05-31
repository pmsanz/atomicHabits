import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Habits from "@/pages/habits";
import Identities from "@/pages/identities";
import Stacks from "@/pages/stacks";
import Journal from "@/pages/journal";
import AiCoach from "@/pages/ai";
import Insights from "@/pages/insights";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { token } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!token && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
  }, [token, location, setLocation]);

  if (!token) return null;

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/habits">{(params) => <ProtectedRoute component={Habits} />}</Route>
      <Route path="/identities">{(params) => <ProtectedRoute component={Identities} />}</Route>
      <Route path="/stacks">{(params) => <ProtectedRoute component={Stacks} />}</Route>
      <Route path="/journal">{(params) => <ProtectedRoute component={Journal} />}</Route>
      <Route path="/ai">{(params) => <ProtectedRoute component={AiCoach} />}</Route>
      <Route path="/insights">{(params) => <ProtectedRoute component={Insights} />}</Route>
      <Route path="/settings">{(params) => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/">{(params) => <ProtectedRoute component={Dashboard} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
