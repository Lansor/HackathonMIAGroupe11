import { faFolderPlus } from "@fortawesome/free-solid-svg-icons/faFolderPlus";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRef, useState } from "react";

type UploadProps = {
  onFilesAdded: (files: globalThis.File[]) => void;
};

function Upload({ onFilesAdded }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setDragging = (
    event: React.DragEvent<HTMLDivElement>,
    value: boolean,
  ) => {
    event.preventDefault();
    setIsDragging(value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    onFilesAdded(files);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    onFilesAdded(Array.from(event.dataTransfer.files));
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
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}

export default Upload;
