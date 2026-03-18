import { faFolderPlus } from "@fortawesome/free-solid-svg-icons/faFolderPlus";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const ACCEPTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

type UploadProps = {
  onFilesAdded: (files: globalThis.File[]) => void;
};

function Upload({ onFilesAdded }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllowedFile = (file: globalThis.File) => {
    if (ACCEPTED_MIME_TYPES.includes(file.type)) {
      return true;
    }

    const fileName = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((extension) =>
      fileName.endsWith(extension),
    );
  };

  const handleValidatedFiles = (files: globalThis.File[]) => {
    const validFiles = files.filter(isAllowedFile);
    const rejectedFilesCount = files.length - validFiles.length;

    setRejectedCount(rejectedFilesCount);

    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  };

  const setDragging = (
    event: React.DragEvent<HTMLDivElement>,
    value: boolean,
  ) => {
    event.preventDefault();
    setIsDragging(value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    handleValidatedFiles(files);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleValidatedFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-6 text-left shadow-sm transition ${
        isDragging
          ? "border-violet-500 bg-violet-50"
          : "border-slate-300 bg-white"
      }`}
      onDragEnter={(event) => setDragging(event, true)}
      onDragOver={(event) => setDragging(event, true)}
      onDragLeave={(event) => setDragging(event, false)}
      onDrop={handleDrop}
    >
      <h2 className="mb-2">Vos fichiers à traiter</h2>
      <p className="mb-4 text-slate-600">Glisse et dépose tes fichiers ici</p>
      <p className="mb-4 text-sm text-slate-500">
        Formats acceptés: PDF, PNG, JPG, JPEG.
      </p>

      {rejectedCount > 0 && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {rejectedCount} fichier{rejectedCount > 1 ? "s" : ""} ignoré
          {rejectedCount > 1 ? "s" : ""} (format non autorisé).
        </p>
      )}

      <button
        type="button"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700"
        onClick={() => inputRef.current?.click()}
      >
        <FontAwesomeIcon icon={faFolderPlus} /> fichiers
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}

export default Upload;
