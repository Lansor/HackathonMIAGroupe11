import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileArrowUp,
  faRobot,
  faShieldHalved,
  faChartBar,
  faArrowRight,
  faBolt,
} from "@fortawesome/free-solid-svg-icons";
import {
  faFileLines,
  faCircleCheck,
} from "@fortawesome/free-regular-svg-icons";

const FEATURES = [
  {
    icon: faFileArrowUp,
    title: "Téléversement simplifié",
    desc: "Déposez vos PDF, PNG ou JPEG en quelques clics. Traitement par lot disponible.",
    color: "#6366f1",
    bg: "#eef2ff",
  },
  {
    icon: faRobot,
    title: "Extraction IA",
    desc: "Nos modèles OCR extraient et structurent automatiquement les données clés de vos documents.",
    color: "#0ea5e9",
    bg: "#e0f2fe",
  },
  {
    icon: faChartBar,
    title: "Tableau de bord analytique",
    desc: "Visualisez l'état de vos traitements, le volume par type et l'historique complet.",
    color: "#10b981",
    bg: "#d1fae5",
  },
  {
    icon: faShieldHalved,
    title: "Sécurité",
    desc: "Authentification sécurisée, rôles administrateur/utilisateur, accès strictement cloisonné par compte.",
    color: "#f59e0b",
    bg: "#fef3c7",
  },
];

const STEPS = [
  {
    num: "01",
    label: "Connectez-vous",
    desc: "Créez un compte ou authentifiez-vous.",
  },
  {
    num: "02",
    label: "Uploadez vos fichiers",
    desc: "Glissez vos documents ou cliquez pour les sélectionner.",
  },
  {
    num: "03",
    label: "Lancez le traitement",
    desc: "Notre IA analyse et extrait les informations clés.",
  },
  {
    num: "04",
    label: "Consultez les résultats",
    desc: "Retrouvez toutes vos données structurées en temps réel.",
  },
];

function HomePage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 px-6 py-16 md:py-20 text-white">
        {/* Cercles décoratifs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white opacity-5" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-white opacity-5" />

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <FontAwesomeIcon icon={faBolt} className="text-yellow-300" />
            Traitement intelligent de documents
          </span>

          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Vos documents,
            <br />
            <span className="text-sky-200">traités par l'IA.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-indigo-100 md:text-lg">
            Uploadez vos fichiers, laissez notre IA extraire les données
            essentielles et consultez les résultats en temps réel depuis votre
            espace personnel.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={() => navigate("/upload")}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-indigo-600 shadow-lg transition hover:bg-indigo-50 hover:shadow-xl"
            >
              <FontAwesomeIcon icon={faFileArrowUp} />
              Commencer maintenant
              <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
            </button>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Se connecter
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats rapides ── */}
      <section className="bg-white py-8 md:py-10 shadow-sm">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 px-6 md:grid-cols-4 md:gap-6">
          {[
            { val: "PDF, PNG, JPG", label: "Formats supportés" },
            { val: "Temps réel", label: "Mise à jour du tableau" },
            { val: "OCR + structuration", label: "Pipeline IA" },
            { val: "100 % sécurisé", label: "Authentification JWT HttpOnly" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-indigo-600">{s.val}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="px-6 py-14 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-3xl font-bold">
            Tout ce dont vous avez besoin
          </h2>
          <p className="mb-8 text-center text-slate-500 md:mb-10">
            Une plateforme complète pour gérer et analyser vos documents
            d'entreprise.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: f.bg, color: f.color }}
                >
                  <FontAwesomeIcon icon={f.icon} />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="bg-slate-100 px-6 py-14 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-3xl font-bold">
            Comment ça marche ?
          </h2>
          <p className="mb-8 text-center text-slate-500 md:mb-10">
            Quatre étapes simples pour traiter vos documents.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="relative flex flex-col items-center text-center"
              >
                {/* Connecteur */}
                {i < STEPS.length - 1 && (
                  <div className="absolute top-6 left-[calc(50%+24px)] hidden h-px w-[calc(100%-48px)] bg-indigo-200 lg:block" />
                )}
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-md">
                  {step.num}
                </div>
                <h3 className="mb-1 font-semibold">{step.label}</h3>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="bg-gradient-to-br from-indigo-600 to-sky-500 px-6 py-14 md:py-16 text-center text-white">
        <FontAwesomeIcon
          icon={faFileLines}
          className="mb-4 text-4xl opacity-80"
        />
        <h2 className="mb-3 text-3xl font-bold">Prêt à commencer ?</h2>
        <p className="mx-auto mb-7 max-w-md text-indigo-100 md:mb-8">
          Créez votre compte et traitez vos premiers documents en quelques
          minutes.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-indigo-600 shadow-lg transition hover:bg-indigo-50"
            >
              <FontAwesomeIcon icon={faCircleCheck} />
              Créer un compte
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            Accéder à l'upload
            <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 px-6 py-8 text-center text-sm text-slate-400">
        © 2026 BuildUp — Groupe 11 · Master IA Hackathon
      </footer>
    </main>
  );
}

export default HomePage;
