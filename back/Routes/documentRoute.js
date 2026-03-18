const express = require("express");
const router = express.Router();
const multer = require("multer");

// Import des fonctions du Controller
const {
  uploadDocument,
  downloadDocument,
  getDocumentInfo,
  generateDocument,
  deleteDocument,
} = require("../Controllers/documentController");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/info/:docId", getDocumentInfo);
router.delete("/delete/:docId", deleteDocument);
router.get("/download/:gridFsId", downloadDocument);
router.get("/generate/:docType", generateDocument);

module.exports = router;
