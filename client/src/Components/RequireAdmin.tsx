import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

function RequireAdmin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/user/me", {
          credentials: "include",
        });

        if (!res.ok) {
          setIsAdmin(false);
          return;
        }

        const data = (await res.json()) as {
          user?: { role?: "user" | "admin" };
        };
        setIsAdmin(data?.user?.role === "admin");
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    void checkAdmin();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/upload" replace />;
  }

  return <Outlet />;
}

export default RequireAdmin;
