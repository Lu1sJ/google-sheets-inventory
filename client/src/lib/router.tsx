import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, type User } from "./auth";

interface RouterContext {
  currentPath: string;
  user: User | null;
  isLoading: boolean;
  push: (path: string) => void;
  replace: (path: string) => void;
}

const RouterContext = createContext<RouterContext | null>(null);

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}

interface RouterProviderProps {
  children: ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  
  const user = data || null;

  const push = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  const replace = (path: string) => {
    window.history.replaceState({}, "", path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Authentication-based routing logic (Next.js-like)
  useEffect(() => {
    if (isLoading) return;

    const publicPaths = ["/"];
    const protectedPaths = ["/dashboard", "/profile", "/admin"];
    
    if (user && currentPath === "/") {
      // Authenticated user on login page -> redirect to dashboard
      replace("/dashboard");
    } else if (!user && protectedPaths.includes(currentPath)) {
      // Unauthenticated user on protected page -> redirect to login
      replace("/");
    }
  }, [user, isLoading, currentPath, replace]);

  return (
    <RouterContext.Provider
      value={{
        currentPath,
        user,
        isLoading,
        push,
        replace,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

interface RouteProps {
  path: string;
  component: React.ComponentType;
}

export function Route({ path, component: Component }: RouteProps) {
  return <Component />;
}

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  adminOnly?: boolean;
}

export function ProtectedRoute({ path, component: Component, adminOnly = false }: ProtectedRouteProps) {
  const { user, isLoading } = useRouter();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-lg mb-4">
            <div className="w-8 h-8 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading...</h2>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }
  
  if (!user) return null;
  
  if (adminOnly && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  return <Component />;
}

export function Router({ children }: { children: ReactNode }) {
  const { currentPath, user, isLoading } = useRouter();
  
  // Find the first matching route
  const routes = React.Children.toArray(children) as React.ReactElement[];
  
  for (const route of routes) {
    if (route.props.path === "*") continue; // Skip catch-all for now
    
    if (route.type === Route && route.props.path === currentPath) {
      return route;
    }
    
    if (route.type === ProtectedRoute && route.props.path === currentPath) {
      return route;
    }
  }
  
  // If no route matched, render catch-all
  const catchAllRoute = routes.find(route => route.props.path === "*");
  return catchAllRoute || null;
}

// Next.js-like Link component
interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function Link({ href, children, className, "data-testid": testId }, ref) {
    const { push } = useRouter();
    
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      push(href);
    };
    
    return (
      <a 
        ref={ref}
        href={href} 
        onClick={handleClick} 
        className={className}
        data-testid={testId}
      >
        {children}
      </a>
    );
  }
);