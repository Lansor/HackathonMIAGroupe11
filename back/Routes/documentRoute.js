const express = require("express");
const router = express.Router();
const multer = require("multer");

// Import des fonctions du Controller
<<<<<<< HEAD
const { uploadDocument, downloadDocument, getDocumentInfo, generateDocument, deleteDocument, getDocumentInfoOCR } = require("../Controllers/documentController");

=======
const {
  uploadDocument,
  downloadDocument,
  getDocumentInfo,
  generateDocument,
  deleteDocument,
  getDocumentInfoOCR,
  getAllCuratedData,
  getDocumentsByUser,
} = require("../Controllers/documentController");
>>>>>>> 8e29b425b927e1f1c824016fa5ab5ef5b947b6bc

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single('file'), uploadDocument);
router.get("/curated/all", getAllCuratedData);
router.post("/upload", upload.single("file"), uploadDocument);
router.get("/user/:userId", getDocumentsByUser);
router.get("/info/:docId", getDocumentInfo);
router.get("/infoOCR/:docId", getDocumentInfoOCR);
router.delete("/delete/:docId", deleteDocument);
router.get("/download/:gridFsId", downloadDocument);
router.get("/generate/:docType", generateDocument);

module.exports = router;
