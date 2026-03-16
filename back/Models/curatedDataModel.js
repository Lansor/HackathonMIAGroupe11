const mongoose = require("mongoose");

const curatedDataSchema = new mongoose.Schema({
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
  doc_type: {
    type: String,
    enum: ["facture", "devis", "urssaf", "kbis", "rib"],
    required: true,
  },
  extracted_fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  compliance: {
    is_valid: { type: Boolean, default: false },
    errors: [String],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CuratedData = mongoose.model("CuratedData", curatedDataSchema);
module.exports = CuratedData;