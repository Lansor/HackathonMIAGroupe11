type ForgetPasswordProps = {
  onGoLogin: () => void;
};

function ForgetPassword({ onGoLogin }: ForgetPasswordProps) {
  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2>Forget Password</h2>

      <p className="text-slate-600">
        Entre ton email pour recevoir un lien de reinitialisation.
      </p>

      <label className="flex flex-col gap-2">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="email@exemple.com"
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700"
      >
        Envoyer le lien
      </button>

      <button
        type="button"
        className="mt-2 self-end text-slate-600 underline underline-offset-4 hover:text-violet-700"
        onClick={onGoLogin}
      >
        Retour au login
      </button>
    </form>
  );
}

export default ForgetPassword;
