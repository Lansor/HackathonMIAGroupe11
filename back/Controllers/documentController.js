const mongoose = require("mongoose");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const RawDocument = require("../Models/rawDocumentModel");
const CleanOCR = require("../Models/cleanOCRModel");
const CuratedData = require("../Models/curatedDataModel");

// Logique pour générer un document PDF
const generateDocument = async (req, res) => {
  try {
    const { docType } = req.params;

    // Types de documents supportés
    const validTypes = ["facture", "devis", "urssaf", "kbis", "rib"];

    if (!validTypes.includes(docType.toLowerCase())) {
      return res.status(400).send({
        error: `Type de document invalide. Types supportés : ${validTypes.join(", ")}`,
      });
    }

    // Chemin du script Python
    const scriptPath = path.join(
      __dirname,
      "../../script/generateDocuments.py",
    );

    // Exécuter le script Python avec le type de document
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(
        "python3",
        [scriptPath, docType.toLowerCase()],
        {
          cwd: path.join(__dirname, "../../script"),
        },
      );

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log("[Python stderr]:", data.toString());
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", stderr);
          return res.status(500).send({
            error: "Erreur lors de la génération du document",
            details: stderr,
          });
        }

        try {
          // Parser la réponse JSON du script Python
          // Il peut y avoir des logs avant le JSON, donc on cherche la première ligne valide JSON
          const lines = stdout.trim().split("\n");
          let result = null;

          // Chercher depuis la fin pour trouver le JSON
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith("{")) {
              try {
                result = JSON.parse(line);
                break;
              } catch (e) {
                // Continuer à chercher
                continue;
              }
            }
          }

          if (!result) {
            throw new Error("Aucun JSON trouvé dans la sortie du script");
          }

          if (!result.success) {
            return res.status(500).send({
              error: "Erreur lors de la génération",
              details: result.error,
            });
          }

          // Récupérer le chemin absolu du fichier
          const filePath = path.resolve(
            path.join(__dirname, "../../script", result.filepath),
          );

          console.log("Generated file path:", filePath);

          // Vérifier que le fichier existe
          if (!fs.existsSync(filePath)) {
            return res.status(500).send({
              error: "Fichier généré non trouvé",
            });
          }

          // Lire le fichier
          const fileContent = fs.readFileSync(filePath);

          // Envoyer le fichier au client
          res.set("Content-Type", "application/pdf");
          res.set(
            "Content-Disposition",
            `attachment; filename="${result.filename}"`,
          );
          res.send(fileContent);

          console.log(`Document envoyé avec succès: ${result.filename}`);

          // Supprimer le fichier temporaire après l'envoi
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting temporary file:", err);
            else console.log("Temporary file deleted:", filePath);
          });
        } catch (error) {
          console.error("Error parsing Python response:", error.message);
          res.status(500).send({
            error: "Erreur lors du traitement de la réponse du script",
            details: error.message,
          });
        }
      });

      pythonProcess.on("error", (error) => {
        console.error("Error spawning python process:", error.message);
        res.status(500).send({
          error: "Erreur lors de l'exécution du script",
        });
      });
    });
  } catch (error) {
    console.log("Error during generation:", error.message);
    res.status(400).send({ error: error.message });
  }
};

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
      gridfs_id: gridfsId, // L'ID généré par GridFS
      filename: filename,
      mime_type: req.file.mimetype,
      status: "PENDING",
    });

    await newRawDoc.save();

    console.log("File and Metadata saved:", newRawDoc._id);
    res.status(201).send({
      message: "Fichier uploadé et enregistré avec succès",
      document_id: newRawDoc._id,
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
    const gridFsId = req.params.gridFsId;
    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });

    // On vérifie si le fichier existe avant de tenter le stream
    const file = await mongoose.connection.db
      .collection("documents.files")
      .findOne({ _id: new mongoose.Types.ObjectId(gridFsId) });

    if (!file) {
      return res.status(404).send({ error: "Fichier non trouvé" });
    }

    res.set("Content-Type", file.contentType);
    const downloadStream = gfs.openDownloadStream(
      new mongoose.Types.ObjectId(gridFsId),
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
    const doc = await RawDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).send({ error: "Document introuvable" });
    }
    res.status(200).send(doc);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Logique pour supprimer un document
const deleteDocument = async (req, res) => {
  try {
    const { docId } = req.params;

    // Chercher le document dans RawDocument par son _id
    const rawDoc = await RawDocument.findById(docId);
    if (!rawDoc) {
      return res.status(404).send({ error: "Document introuvable" });
    }

    const gridfsId = rawDoc.gridfs_id;

    // Créer une instance GridFSBucket pour supprimer le fichier
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });

    // Supprimer le fichier de GridFS (documents.files et documents.chunks)
    await bucket.delete(new mongoose.Types.ObjectId(gridfsId));
    console.log("GridFS file deleted:", gridfsId);

    // Supprimer l'entrée de RawDocument
    await RawDocument.findByIdAndDelete(docId);
    console.log("RawDocument deleted:", docId);

    res.status(200).send({
      message: "Document supprimé avec succès",
      document_id: docId,
    });
  } catch (error) {
    console.log("Error deleting document:", error.message);
    res.status(400).send({ error: error.message });
  }
};

const getDocumentInfoOCR = async (req, res) => {
  try {
    const { docId } = req.params;

    const rawDoc = await CleanOCR.findById(docId);
    if (!rawDoc) {
      return res.status(404).send({ error: "Document introuvable" });
    }

    res.status(200).send(rawDoc);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Logique pour récupérer tous les documents d'un utilisateur
const getDocumentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const docs = await RawDocument.find({ user_id: userId }).sort({
      createdAt: -1,
    });
    return res.status(200).send({
      message: "Documents récupérés avec succès",
      count: docs.length,
      documents: docs,
    });
  } catch (error) {
    console.log("Error fetching documents by user:", error.message);
    res.status(400).send({ error: error.message });
  }
};

const getAllCuratedData = async (_req, res) => {
  try {
    const curatedData = await CuratedData.find({})
      .sort({ createdAt: -1 })
      .lean();

    const rawDocumentIds = curatedData
      .map((item) => item.raw_document_id || item.document_id)
      .filter(Boolean)
      .map((id) => String(id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const rawDocuments =
      rawDocumentIds.length > 0
        ? await RawDocument.find({ _id: { $in: rawDocumentIds } })
            .select("_id filename user_id")
            .lean()
        : [];

    const rawInfoById = new Map(
      rawDocuments.map((doc) => [
        String(doc._id),
        { filename: doc.filename, user_id: doc.user_id },
      ]),
    );

    const curatedDataWithFilename = curatedData.map((item) => {
      const rawId = item.raw_document_id || item.document_id;
      const alertMessages = Array.isArray(item.alerts)
        ? item.alerts
            .map((alert) => alert?.message)
            .filter(Boolean)
        : [];
      const complianceStatus =
        item.compliance?.status ||
        item.status ||
        (alertMessages.length > 0 ? "ANOMALIE" : "VALIDATED");
      const complianceMessage =
        item.compliance?.message ||
        item.compliance?.errors?.[0] ||
        alertMessages[0] ||
        "";
      const complianceErrors =
        item.compliance?.errors ||
        (alertMessages.length > 0 ? alertMessages : []);

      return {
        ...item,
        filename:
          item.filename ||
          (rawId ? rawInfoById.get(String(rawId))?.filename : undefined) ||
          "Fichier inconnu",
        user_id:
          item.user_id ||
          (rawId ? rawInfoById.get(String(rawId))?.user_id : undefined),
        compliance: {
          is_valid:
            typeof item.compliance?.is_valid === "boolean"
              ? item.compliance.is_valid
              : alertMessages.length === 0 &&
                !String(complianceStatus).includes("NEEDS_REVIEW") &&
                !String(complianceStatus).includes("INCOMPLET") &&
                !String(complianceStatus).includes("BLOQUE") &&
                !String(complianceStatus).includes("FAILED"),
          status: complianceStatus,
          message: complianceMessage,
          errors: complianceErrors,
        },
      };
    });

    res.status(200).send({ curatedData: curatedDataWithFilename });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  uploadDocument,
  downloadDocument,
  getDocumentInfo,
  generateDocument,
  deleteDocument,
  getDocumentInfoOCR,
  getAllCuratedData,
  getDocumentsByUser,
};
