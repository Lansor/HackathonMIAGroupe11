import { useState } from "react";
import Login from "../components/auth/Login";
import ForgetPassword from "../components/auth/ForgetPassword";
import Register from "../components/auth/Register";

type AuthView = "login" | "forget-password" | "register";

function AuthPage() {
  const [view, setView] = useState<AuthView>("login");

  const authMeta: Record<AuthView, { title: string; subtitle: string }> = {
    login: {
      title: "Connexion",
      subtitle: "Entre sur la plateforme avec ton compte.",
    },
    "forget-password": {
      title: "Recuperation",
      subtitle: "Reinitialise ton mot de passe en 1 etape.",
    },
    register: {
      title: "Inscription",
      subtitle: "Cree ton compte avec tes informations de base.",
    },
  };

  return (
    <main className="px-5 py-8 border-none">
      <nav
        className="mx-auto mb-6 flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
        role="tablist"
        aria-label="Choix du formulaire"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "login"}
          className={`flex-1 rounded-lg px-4 py-2 transition ${
            view === "login"
              ? "bg-violet-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setView("login")}
        >
          Login
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "forget-password"}
          className={`flex-1 rounded-lg px-4 py-2 transition ${
            view === "forget-password"
              ? "bg-violet-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setView("forget-password")}
        >
          Forgot
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "register"}
          className={`flex-1 rounded-lg px-4 py-2 transition ${
            view === "register"
              ? "bg-violet-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setView("register")}
        >
          Register
        </button>
      </nav>

      <section className="mx-auto mb-5 w-full max-w-md text-left">
        <h2>{authMeta[view].title}</h2>
        <p className="text-slate-600">{authMeta[view].subtitle}</p>
      </section>

      <div key={view} className="auth-panel-enter">
        {view === "login" && (
          <Login
            onGoRegister={() => setView("register")}
            onGoForgetPassword={() => setView("forget-password")}
          />
        )}
        {view === "forget-password" && (
          <ForgetPassword onGoLogin={() => setView("login")} />
        )}
        {view === "register" && <Register onGoLogin={() => setView("login")} />}
      </div>
    </main>
  );
}

export default AuthPage;
