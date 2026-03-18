const mongoose = require("mongoose");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const RawDocument = require("../Models/rawDocumentModel");

const generateDocument = async (req, res) => {
    try {
        const { docType } = req.params;
        const validTypes = ["facture", "devis", "urssaf", "kbis", "rib"];

        if (!validTypes.includes(docType.toLowerCase())) {
            return res.status(400).send({
                error: `Type de document invalide. Types supportés : ${validTypes.join(", ")}`,
            });
        }

        const scriptPath = path.join(__dirname, "../../script/generateDocuments.py");
        const pythonBin = process.platform === "win32" ? "py" : "python3";

        return new Promise((resolve) => {
            const pythonProcess = spawn(pythonBin, [scriptPath, docType.toLowerCase()], {
                cwd: path.join(__dirname, "../../script"),
            });

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
                    resolve(
                        res.status(500).send({
                            error: "Erreur lors de la génération du document",
                            details: stderr,
                        }),
                    );
                    return;
                }

                try {
                    const lines = stdout.trim().split("\n");
                    let result = null;

                    for (let index = lines.length - 1; index >= 0; index -= 1) {
                        const line = lines[index].trim();
                        if (!line.startsWith("{")) {
                            continue;
                        }

                        try {
                            result = JSON.parse(line);
                            break;
                        } catch (_error) {
                            continue;
                        }
                    }

                    if (!result) {
                        throw new Error("Aucun JSON trouvé dans la sortie du script");
                    }

                    if (!result.success) {
                        resolve(
                            res.status(500).send({
                                error: "Erreur lors de la génération",
                                details: result.error,
                            }),
                        );
                        return;
                    }

                    const filePath = path.resolve(path.join(__dirname, "../../script", result.filepath));

                    if (!fs.existsSync(filePath)) {
                        resolve(
                            res.status(500).send({
                                error: "Fichier généré non trouvé",
                            }),
                        );
                        return;
                    }

                    const fileContent = fs.readFileSync(filePath);
                    res.set("Content-Type", "application/pdf");
                    res.set("Content-Disposition", `attachment; filename="${result.filename}"`);
                    res.send(fileContent);

                    fs.unlink(filePath, (error) => {
                        if (error) {
                            console.error("Error deleting temporary file:", error);
                        }
                    });

                    resolve();
                } catch (error) {
                    console.error("Error parsing Python response:", error.message);
                    resolve(
                        res.status(500).send({
                            error: "Erreur lors du traitement de la réponse du script",
                            details: error.message,
                        }),
                    );
                }
            });

            pythonProcess.on("error", (error) => {
                console.error("Error spawning python process:", error.message);
                resolve(
                    res.status(500).send({
                        error: "Erreur lors de l'exécution du script",
                    }),
                );
            });
        });
    } catch (error) {
        console.log("Error during generation:", error.message);
        return res.status(400).send({ error: error.message });
    }
};

const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            console.log("Upload failed: No file provided");
            return res.status(400).send({ error: "Aucun fichier fourni" });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "documents",
        });

        const filename = `${Date.now()}-${req.file.originalname}`;
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: req.file.mimetype,
        });

        const gridfsId = await new Promise((resolve, reject) => {
            uploadStream.on("finish", () => {
                resolve(uploadStream.id);
            });
            uploadStream.on("error", reject);
            uploadStream.end(req.file.buffer);
        });

        const newRawDoc = new RawDocument({
            user_id: req.body.user_id || req.user?._id,
            document_id: `DOC-${Date.now()}`,
            gridfs_id: gridfsId,
            filename,
            mime_type: req.file.mimetype,
            status: "PENDING",
        });

        await newRawDoc.save();

        return res.status(201).send({
            message: "Fichier uploadé et enregistré avec succès",
            document: newRawDoc,
        });
    } catch (error) {
        console.log("Error during upload:", error.message);
        return res.status(400).send({ error: error.message });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const gridFsId = req.params.gridFsId || req.params.fileId;

        const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "documents",
        });

        const file = await mongoose.connection.db
            .collection("documents.files")
            .findOne({ _id: new mongoose.Types.ObjectId(gridFsId) });

        if (!file) {
            return res.status(404).send({ error: "Fichier non trouvé" });
        }

        res.set("Content-Type", file.contentType);
        const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(gridFsId));
        downloadStream.pipe(res);
        return undefined;
    } catch (error) {
        console.log("Error downloading file:", error.message);
        return res.status(400).send({ error: error.message });
    }
};

const getDocumentInfo = async (req, res) => {
    try {
        const { docId } = req.params;
        let doc = await RawDocument.findOne({ document_id: docId });

        if (!doc && mongoose.Types.ObjectId.isValid(docId)) {
            doc = await RawDocument.findById(docId);
        }

        if (!doc) {
            return res.status(404).send({ error: "Document introuvable" });
        }

        return res.status(200).send(doc);
    } catch (error) {
        return res.status(400).send({ error: error.message });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { docId } = req.params;

        let rawDoc = await RawDocument.findOne({ document_id: docId });
        if (!rawDoc && mongoose.Types.ObjectId.isValid(docId)) {
            rawDoc = await RawDocument.findById(docId);
        }

        if (!rawDoc) {
            return res.status(404).send({ error: "Document introuvable" });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "documents",
        });

        await bucket.delete(new mongoose.Types.ObjectId(rawDoc.gridfs_id));
        await RawDocument.findByIdAndDelete(rawDoc._id);

        return res.status(200).send({
            message: "Document supprimé avec succès",
            document_id: rawDoc.document_id,
        });
    } catch (error) {
        console.log("Error deleting document:", error.message);
        return res.status(400).send({ error: error.message });
    }
};

module.exports = {
    uploadDocument,
    downloadDocument,
    getDocumentInfo,
    generateDocument,
    deleteDocument,
};
