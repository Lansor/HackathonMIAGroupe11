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
    rawFile: file,
  }));
};

const getPendingLabel = (items: UploadedItem[]) =>
  items.length === 1 ? items[0].name : `${items.length} fichiers en cours`;

function UploadFile() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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

  const getCurrentUserId = async () => {
    try {
      const response = await fetch("/api/user/me", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { user?: { id?: string } };
      return data.user?.id ?? null;
    } catch (_error) {
      return null;
    }
  };

  const uploadOne = async (item: UploadedItem, userId: string | null) => {
    const formData = new FormData();
    formData.append("file", item.rawFile);

    if (userId) {
      formData.append("user_id", userId);
    }

    try {
      const response = await fetch("/api/document/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      return response.ok ? "success" : "error";
    } catch (_error) {
      return "error";
    }
  };

  const handleProcess = async () => {
    if (isProcessing) {
      return;
    }

    const pendingItems = uploadedFiles.filter(
      (item) => item.status === "pending_api",
    );

    if (pendingItems.length === 0) {
      return;
    }

    setIsProcessing(true);

    const userId = await getCurrentUserId();

    for (const item of pendingItems) {
      const status = await uploadOne(item, userId);

      setUploadedFiles((previous) =>
        previous.map((current) =>
          current.id === item.id ? { ...current, status } : current,
        ),
      );
    }

    setIsProcessing(false);
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
          onProcess={handleProcess}
          isProcessDisabled={
            uploadedFiles.length === 0 ||
            isUploading ||
            isProcessing ||
            !uploadedFiles.some((item) => item.status === "pending_api")
          }
          isProcessing={isProcessing}
        />
      </div>
    </section>
  );
}

export default UploadFile;
