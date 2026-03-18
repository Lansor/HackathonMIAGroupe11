import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleUser } from "@fortawesome/free-regular-svg-icons";

function NavMenu() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
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
      }
    };

    void loadCurrentUser();
  }, []);

  const handleDashboard = () => {
    if (!isAdmin) return;
    navigate("/dashboard");
    setIsOpen(false);
  };
  const handleLogout = async () => {
    try {
      await fetch(`/api/user/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      localStorage.removeItem("authToken");
      setIsOpen(false);
      navigate("/auth");
    }
  };

  return (
    <header className="px-5 py-4">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen((previous) => !previous)}
            aria-label="Ouvrir le menu utilisateur"
            aria-expanded={isOpen}
          >
            <FontAwesomeIcon icon={faCircleUser} size="lg" />
          </button>

          {isOpen && (
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-slate-400"
                disabled
              >
                Menu 1 (bientot)
              </button>
              <button
                type="button"
                className={
                  isAdmin
                    ? "w-full rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    : "w-full rounded-md px-3 py-2 text-left text-slate-400"
                }
                onClick={handleDashboard}
                disabled={!isAdmin}
              >
                {isAdmin ? "Dashboard" : "Dashboard (admin requis)"}
              </button>
              <hr className="my-2 border-slate-200" />
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-red-600 hover:bg-red-50"
                onClick={handleLogout}
              >
                Deconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default NavMenu;