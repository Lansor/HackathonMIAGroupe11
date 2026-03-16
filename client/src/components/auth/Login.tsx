type LoginProps = {
  onGoRegister: () => void;
  onGoForgetPassword: () => void;
};

function Login({ onGoRegister, onGoForgetPassword }: LoginProps) {
  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2>Login</h2>

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

      <label className="flex flex-col gap-2">
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="********"
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700"
      >
        Se connecter
      </button>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-slate-600 underline underline-offset-4 hover:text-violet-700"
          onClick={onGoForgetPassword}
        >
          Mot de passe oublie ?
        </button>

        <button
          type="button"
          className="text-slate-600 underline underline-offset-4 hover:text-violet-700"
          onClick={onGoRegister}
        >
          Creer un compte
        </button>
      </div>
    </form>
  );
}

export default Login;
