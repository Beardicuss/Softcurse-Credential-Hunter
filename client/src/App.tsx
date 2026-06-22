import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AdminToaster = lazy(() => import("./components/admin/AdminToaster"));
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
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        {isAdminRoute && (
          <Suspense fallback={null}>
            <AdminToaster />
          </Suspense>
        )}
        <Router />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;