const mongoose = require("mongoose");

const cleanOCRSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  document_id: {
    type: String, // Référence au document_id de RawDocument
    required: true,
    unique: true,
  },
  ocr_engine: {
    type: String,
    required: true,
  },
  raw_text: {
    type: String,
    required: true,
  },
  conf_score: {
    type: Number,
    min: 0,
    max: 1,
  },
  pages: {
    type: Array, 
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CleanOCR = mongoose.model("CleanOCR", cleanOCRSchema);
module.exports = CleanOCR;