import { useEffect, useRef, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

type RawDocument = {
  _id: string;
  filename: string;
  mime_type: string;
  status: "PENDING" | "OCR_COMPLETED" | "CURATED" | "FAILED";
  createdAt: string;
};

const STATUS_LABELS: Record<RawDocument["status"], string> = {
  PENDING: "En attente",
  OCR_COMPLETED: "OCR terminé",
  CURATED: "Traité",
  FAILED: "Échoué",
};

const STATUS_COLORS: Record<RawDocument["status"], string> = {
  PENDING: "#f1f5f9",
  OCR_COMPLETED: "#dbeafe",
  CURATED: "#d1fae5",
  FAILED: "#fee2e2",
};

const STATUS_TEXT_COLORS: Record<RawDocument["status"], string> = {
  PENDING: "#64748b",
  OCR_COMPLETED: "#1d4ed8",
  CURATED: "#065f46",
  FAILED: "#991b1b",
};

type TableFileProps = {
  userId: string | null;
};

const POLL_INTERVAL_MS = 5000;

function TableFile({ userId }: TableFileProps) {
  const [documents, setDocuments] = useState<RawDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstFetch = useRef(true);

  useEffect(() => {
    if (!userId) return;

    const fetchDocuments = () => {
      // Ne montre le spinner que sur le premier chargement
      if (isFirstFetch.current) setLoading(true);

      fetch(`/api/document/user/${userId}`, { credentials: "include" })
        .then((res) => {
          if (!res.ok)
            throw new Error("Impossible de récupérer les documents.");
          return res.json() as Promise<{ documents: RawDocument[] }>;
        })
        .then(({ documents }) => {
          setDocuments(documents);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => {
          isFirstFetch.current = false;
          setLoading(false);
        });
    };

    fetchDocuments();
    const interval = setInterval(fetchDocuments, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId]);

  if (!userId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
        Chargement des documents…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">Aucun document trouvé.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {`${documents.length} document${documents.length > 1 ? "s" : ""}`}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Synchronisé
        </span>
      </div>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: "1px solid #e2e8f0", borderRadius: "12px" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>
                Fichier
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>
                Type
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>
                Statut
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>
                Date
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc._id} hover>
                <TableCell
                  sx={{
                    maxWidth: 240,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {doc.filename.replace(/^\d+-/, "")}
                </TableCell>
                <TableCell sx={{ color: "#64748b", fontSize: "0.75rem" }}>
                  {doc.mime_type}
                </TableCell>
                <TableCell>
                  <span
                    style={{
                      backgroundColor: STATUS_COLORS[doc.status],
                      color: STATUS_TEXT_COLORS[doc.status],
                      borderRadius: "9999px",
                      padding: "2px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {STATUS_LABELS[doc.status]}
                  </span>
                </TableCell>
                <TableCell
                  sx={{
                    color: "#64748b",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(doc.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default TableFile;
