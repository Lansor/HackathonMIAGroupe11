import { useRef, useState } from "react";

type UploadProps = {
  onFilesAdded: (files: File[]) => void;
};

function Upload({ onFilesAdded }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <h2 className="mb-2">Upload</h2>
      <p className="mb-4 text-slate-600">
        Glisse et depose tes fichiers ici ou clique sur le bouton upload.
      </p>

      <button
        type="button"
        className="rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700"
        onClick={() => inputRef.current?.click()}
      >
        Upload
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
