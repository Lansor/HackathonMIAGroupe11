import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-regular-svg-icons";

type UploadedItem = {
  id: string;
  name: string;
};

type FileListProps = {
  files: UploadedItem[];
  isUploading: boolean;
  pendingLabel: string;
  onDelete: (id: string) => void;
};

function File({ files, isUploading, pendingLabel, onDelete }: FileListProps) {
  return (
    <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-800">Fichiers uploades</h3>
      </div>

      <ul className="divide-y divide-slate-200">
        {isUploading && (
          <li className="flex items-center gap-2 px-4 py-3 text-slate-600">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
            <span>{pendingLabel}</span>
          </li>
        )}

        {files.length === 0 ? (
          <li className="px-4 py-3 text-slate-500">
            Aucun fichier pour le moment.
          </li>
        ) : (
          files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-slate-700">
                {file.name}
              </span>
              <button
                type="button"
                className="h-7 w-7 rounded-full border border-slate-300 font-semibold leading-none text-slate-600 hover:bg-slate-100"
                onClick={() => onDelete(file.id)}
                aria-label={`Supprimer ${file.name}`}
                title="Supprimer"
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

export default File;
