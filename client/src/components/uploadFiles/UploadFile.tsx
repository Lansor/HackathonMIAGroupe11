import { useState } from "react";
import Upload from "./sous-composants/Upload";
import FileList from "./sous-composants/File";
import type { UploadedItem } from "./types";

const FAKE_UPLOAD_DELAY_MS = 900;

const createUploadedItems = (files: globalThis.File[]): UploadedItem[] => {
  const uploadedAt = Date.now();

  return files.map((file, index) => ({
    id: `${uploadedAt}-${index}-${file.name}`,
    name: file.name,
    status: "pending_api",
  }));
};

const getPendingLabel = (items: UploadedItem[]) =>
  items.length === 1 ? items[0].name : `${items.length} fichiers en cours`;

function UploadFile() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");

  const handleFilesAdded = (files: globalThis.File[]) => {
    if (files.length === 0) {
      return;
    }

    const newItems = createUploadedItems(files);

    setIsUploading(true);
    setPendingLabel(getPendingLabel(newItems));

    window.setTimeout(() => {
      setUploadedFiles((previous) => [...newItems.reverse(), ...previous]);
      setIsUploading(false);
      setPendingLabel("");
    }, FAKE_UPLOAD_DELAY_MS);
  };

  const handleDelete = (id: string) => {
    setUploadedFiles((previous) => previous.filter((item) => item.id !== id));
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Upload onFilesAdded={handleFilesAdded} />
      </div>
      <div className="lg:col-span-2">
        <FileList
          files={uploadedFiles}
          isUploading={isUploading}
          pendingLabel={pendingLabel}
          onDelete={handleDelete}
        />
      </div>
    </section>
  );
}

export default UploadFile;
