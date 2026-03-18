import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" };

type AuthAction =
  | { type: "SET_USER"; user: AuthUser }
  | { type: "LOGOUT" }
  | { type: "LOADED_WITHOUT_USER" };

function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_USER":
      return { status: "authenticated", user: action.user };
    case "LOGOUT":
    case "LOADED_WITHOUT_USER":
      return { status: "unauthenticated" };
  }
}

type AuthContextValue = {
  state: AuthState;
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = "/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { status: "loading" });

  // Vérifie la session au montage via le cookie httpOnly
  useEffect(() => {
    fetch(`${API_BASE}/user/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("unauthenticated");
        return res.json() as Promise<{ user: AuthUser }>;
      })
      .then(({ user }) => dispatch({ type: "SET_USER", user }))
      .catch(() => dispatch({ type: "LOADED_WITHOUT_USER" }));
  }, []);

  const setUser = (user: AuthUser) => dispatch({ type: "SET_USER", user });

  const logout = async () => {
    await fetch(`${API_BASE}/user/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    dispatch({ type: "LOGOUT" });
  };

  return (
    <AuthContext.Provider value={{ state, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
