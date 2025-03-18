import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Forum from "@/pages/home";
import Login from "@/pages/login";
import Profile from "@/pages/profile";
import Thread from "@/pages/thread";
import Landing from "@/pages/landing";
import About from "@/pages/about";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { useAuth } from "./lib/useAuth";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return <Component />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/login" component={Login} />
            <Route path="/forum" component={() => <PrivateRoute component={Forum} />} />
            <Route path="/profile" component={() => <PrivateRoute component={Profile} />} />
            <Route path="/thread/:id" component={() => <PrivateRoute component={Thread} />} />
            <Route path="/about" component={About} />
            <Route component={NotFound} />
          </Switch>
        </main>
        <Footer />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;