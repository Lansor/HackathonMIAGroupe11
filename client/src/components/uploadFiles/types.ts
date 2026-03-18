export type UploadStatus = "pending_api" | "success" | "error";

export type UploadedItem = {
  id: string;
  name: string;
  status: UploadStatus;
};
