const mongoose = require("mongoose");
const RawDocument = require("../Models/rawDocumentModel");

// Logique pour l'upload (appelée après que Multer ait fait son travail)
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      console.log("Upload failed: No file provided");
      return res.status(400).send({ error: "Aucun fichier fourni" });
    }

    // Get GridFS bucket from MongoDB connection
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });

    const filename = `${Date.now()}-${req.file.originalname}`;
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });

    // Upload file to GridFS
    const gridfsId = await new Promise((resolve, reject) => {
      uploadStream.on("finish", () => {
        resolve(uploadStream.id);
      });
      uploadStream.on("error", reject);
      uploadStream.end(req.file.buffer);
    });

    // Création de l'entrée dans RawDocument pour lier le binaire à la logique métier
    const newRawDoc = new RawDocument({
      user_id: req.body.user_id || req.user?._id,
      document_id: `DOC-${Date.now()}`, // Génération d'un ID unique
      gridfs_id: gridfsId, // L'ID généré par GridFS
      filename: filename,
      mime_type: req.file.mimetype,
      status: "PENDING",
    });

    await newRawDoc.save();

    console.log("File and Metadata saved:", newRawDoc.document_id);
    res.status(201).send({
      message: "Fichier uploadé et enregistré avec succès",
      document: newRawDoc,
    });
  } catch (error) {
    console.log("Error during upload:", error.message);
    res.status(400).send({ error: error.message });
  }
};

// Logique pour le téléchargement
const downloadDocument = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });

    // On vérifie si le fichier existe avant de tenter le stream
    const file = await mongoose.connection.db
      .collection("documents.files")
      .findOne({ _id: new mongoose.Types.ObjectId(fileId) });

    if (!file) {
      return res.status(404).send({ error: "Fichier non trouvé" });
    }

    res.set("Content-Type", file.contentType);
    const downloadStream = gfs.openDownloadStream(
      new mongoose.Types.ObjectId(fileId),
    );

    console.log("Streaming file:", file.filename);
    downloadStream.pipe(res);
  } catch (error) {
    console.log("Error downloading file:", error.message);
    res.status(400).send({ error: error.message });
  }
};

// Logique pour récupérer les métadonnées d'un document
const getDocumentInfo = async (req, res) => {
  try {
    const doc = await RawDocument.findOne({ document_id: req.params.docId });
    if (!doc) {
      return res.status(404).send({ error: "Document introuvable" });
    }
    res.status(200).send(doc);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  uploadDocument,
  downloadDocument,
  getDocumentInfo,
};
