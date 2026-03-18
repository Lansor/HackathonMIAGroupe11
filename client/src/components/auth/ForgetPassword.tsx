import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";

type ForgetPasswordProps = {
  onGoLogin: () => void;
};

function ForgetPassword({ onGoLogin }: ForgetPasswordProps) {
  const [isEmailValidated, setIsEmailValidated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const endpoint = isEmailValidated
        ? `/api/user/reset-password`
        : `/api/user/forgot-password`;

      if (isEmailValidated && password !== confirmPassword) {
        throw new Error("Les deux mots de passe doivent etre identiques.");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEmailValidated ? { email, password } : { email },
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur pendant la demande de reset.");
      }

      if (!isEmailValidated) {
        setIsEmailValidated(true);
        setSuccessMessage(
          "Email valide. Tu peux definir un nouveau mot de passe.",
        );
      } else {
        setSuccessMessage(data.message || "Mot de passe modifie avec succes.");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erreur inconnue pendant forgot password.",
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

      <p className="text-slate-600">
        {isEmailValidated
          ? "Definis ton nouveau mot de passe puis confirme-le."
          : "Entre ton email pour valider ton identite."}
      </p>

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
          disabled={isLoading || isEmailValidated}
          required
        />
      </label>

      {isEmailValidated && (
        <>
          <label className="flex flex-col gap-2">
            <span>Nouveau mot de passe</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="newPassword"
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

          <label className="flex flex-col gap-2">
            <span>Confirmer le mot de passe</span>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10"
                placeholder="********"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isLoading}
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 text-slate-500 hover:text-slate-700"
                onClick={() => setShowConfirmPassword((previous) => !previous)}
                aria-label={
                  showConfirmPassword
                    ? "Masquer la confirmation"
                    : "Afficher la confirmation"
                }
                disabled={isLoading}
              >
                <FontAwesomeIcon
                  icon={showConfirmPassword ? faEyeSlash : faEye}
                />
              </button>
            </div>
          </label>
        </>
      )}

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isLoading}
      >
        {isLoading
          ? "Envoi..."
          : isEmailValidated
            ? "Changer le mot de passe"
            : "Valider l'email"}
      </button>

      <button
        type="button"
        className="mt-2 self-end text-slate-600 underline underline-offset-4 hover:text-violet-700"
        onClick={onGoLogin}
        disabled={isLoading}
      >
        Retour au login
      </button>
    </form>
  );
}

export default ForgetPassword;
