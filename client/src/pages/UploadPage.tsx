import { useEffect, useState } from "react";
import UploadFile from "../components/uploadFiles/UploadFile";
import TableFile from "../components/TableFile/TableFile";

function UploadPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { id?: string } } | null) => {
        setUserId(data?.user?.id ?? null);
      })
      .catch(() => setUserId(null));
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-6 pt-6 pb-16 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">
            Service de Traitement des documents
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Bienvenue sur le service de traitement de documents. Ici, tu peux
            téléverser tes documents et les faire traiter par notre IA pour en
            extraire les informations clés. Commence par ajouter tes fichiers,
            puis clique sur "Envoyer" pour lancer le processus de traitement.
            Une fois le traitement terminé, tu pourras consulter les résultats
            directement sur cette page.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <UploadFile />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Mes documents
          </h2>
          <TableFile userId={userId} />
        </section>
      </div>
    </main>
  );
}

export default UploadPage;
