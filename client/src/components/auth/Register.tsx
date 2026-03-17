import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";

type RegisterProps = {
  onGoLogin: () => void;
};

function Register({ onGoLogin }: RegisterProps) {
  const [firstName, setFirstName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const username = `${firstName.trim()} ${name.trim()}`.trim();

      const response = await fetch("/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Erreur pendant la creation du compte.",
        );
      }

      setSuccessMessage(data.message || "Utilisateur cree avec succes.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erreur inconnue pendant inscription.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <h2>Register</h2>

      {errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          {successMessage}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span>First-name</span>
        <input
          type="text"
          name="firstName"
          autoComplete="given-name"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Prenom"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          disabled={isLoading}
          required
        />
      </label>

      <label className="flex flex-col gap-2">
        <span>Name</span>
        <input
          type="text"
          name="name"
          autoComplete="family-name"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Nom"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isLoading}
          required
        />
      </label>

      <label className="flex flex-col gap-2">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="email@exemple.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
          required
        />
      </label>

      <label className="flex flex-col gap-2">
        <span>Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isLoading}
            minLength={8}
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-2 text-slate-500 hover:text-slate-700"
            onClick={() => setShowPassword((previous) => !previous)}
            aria-label={
              showPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
          </button>
        </div>
      </label>

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isLoading}
      >
        {isLoading ? "Creation..." : "Creer un compte"}
      </button>

      <button
        type="button"
        className="mt-2 self-end text-slate-600 underline underline-offset-4 hover:text-violet-700"
        onClick={onGoLogin}
        disabled={isLoading}
      >
        Deja un compte ? Se connecter
      </button>
    </form>
  );
}

export default Register;
