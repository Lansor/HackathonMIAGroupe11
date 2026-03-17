import type { UploadStatus } from "../types";

type FileStatusBadgeProps = {
  status: UploadStatus;
};

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending_api: "En attente API",
  success: "Traite",
  error: "Anomalie(s)",
};

const STATUS_CLASSES: Record<Exclude<UploadStatus, "pending_api">, string> = {
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
};

function FileStatusBadge({ status }: FileStatusBadgeProps) {
  if (status === "pending_api") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />
        <span>{STATUS_LABELS.pending_api}</span>
      </span>
    );
  }

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default FileStatusBadge;
