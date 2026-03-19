import { useState } from "react";
import Login from "../components/auth/Login";
import ForgetPassword from "../components/auth/ForgetPassword";
import Register from "../components/auth/Register";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUnlockKeyhole } from "@fortawesome/free-solid-svg-icons";

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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 px-6 py-10 md:py-14 text-white">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white opacity-10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-white opacity-10" />

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-4xl">
            Espace Authentification
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-indigo-100 md:mt-3 md:text-base">
            Connectez-vous ou créez votre compte pour accéder au traitement
            intelligent de documents.
          </p>
        </div>
      </section>

      {/* <section className="mx-auto -mt-6 w-full max-w-5xl px-5 pb-10 md:pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg md:p-6"> */}
      <nav
        className="mx-auto mb-5 flex w-full max-w-md items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5"
        role="tablist"
        aria-label="Choix du formulaire"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "login"}
          className={`flex-1 rounded-lg px-4 py-2 transition ${
            view === "login"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setView("login")}
        >
          Connexion
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "forget-password"}
          className={`flex-1 rounded-lg px-4 py-2 transition ${
            view === "forget-password"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setView("forget-password")}
        >
          <FontAwesomeIcon icon={faUnlockKeyhole} />
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "register"}
          className={`flex-1 rounded-lg px-4 py-2 transition ${
            view === "register"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setView("register")}
        >
          Inscription
        </button>
      </nav>

      <section className="mx-auto mb-4 w-full max-w-md text-left md:mb-5">
        <h2 className="text-2xl font-bold text-slate-900">
          {authMeta[view].title}
        </h2>
        <p className="mt-1 text-slate-600">{authMeta[view].subtitle}</p>
      </section>

      <div key={view}>
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
      {/* </div>
      </section> */}
    </main>
  );
}

export default AuthPage;
