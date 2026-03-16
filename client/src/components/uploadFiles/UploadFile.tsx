import { useState } from "react";
import Upload from "./sous-composants/Upload";
import File from "./sous-composants/File";

type UploadedItem = {
  id: string;
  name: string;
};

function UploadFile() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");

  const handleFilesAdded = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const uploadedAt = Date.now();
    const newItems: UploadedItem[] = files.map((file, index) => ({
      id: `${uploadedAt}-${index}-${file.name}`,
      name: file.name,
    }));

    setIsUploading(true);
    setPendingLabel(
      newItems.length === 1
        ? newItems[0].name
        : `${newItems.length} fichiers en cours`,
    );

    window.setTimeout(() => {
      setUploadedFiles((previous) => [...newItems.reverse(), ...previous]);
      setIsUploading(false);
      setPendingLabel("");
    }, 900);
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
        <File
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
