import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const ValidKeyVault = lazy(() => import("./pages/ValidKeyVault"));
const HunterOperations = lazy(() => import("./pages/HunterOperations"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Router() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center data-text text-[var(--c-cyan)]">
          LOADING HUNTER SURFACE...
        </div>
      }
    >
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/keys" component={AdminDashboard} />
        <Route path="/admin/vault" component={ValidKeyVault} />
        <Route path="/admin/operations" component={HunterOperations} />
        <Route path="/admin/audit" component={AuditLogs} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
