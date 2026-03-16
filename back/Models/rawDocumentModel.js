const mongoose = require("mongoose");

const rawDocumentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  document_id: {
    type: String,
    required: true,
    unique: true,
  },
  // L'ID de référence vers GridFS (fs.files)
  gridfs_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  mime_type: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["PENDING", "OCR_COMPLETED", "CURATED", "FAILED"],
    default: "PENDING",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const RawDocument = mongoose.model("RawDocument", rawDocumentSchema);

module.exports = RawDocument;