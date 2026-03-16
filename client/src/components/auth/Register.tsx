type RegisterProps = {
  onGoLogin: () => void;
};

function Register({ onGoLogin }: RegisterProps) {
  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2>Register</h2>

      <label className="flex flex-col gap-2">
        <span>First-name</span>
        <input
          type="text"
          name="firstName"
          autoComplete="given-name"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Prenom"
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
        />
      </label>

      <label className="flex flex-col gap-2">
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="********"
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700"
      >
        Creer un compte
      </button>

      <button
        type="button"
        className="mt-2 self-end text-slate-600 underline underline-offset-4 hover:text-violet-700"
        onClick={onGoLogin}
      >
        Deja un compte ? Se connecter
      </button>
    </form>
  );
}

export default Register;
