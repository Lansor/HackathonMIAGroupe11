require('dotenv').config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// Configuration des constantes
const PORT = process.env.SERVER_PORT || 8080;
const dbUrl = process.env.DB_URL;

// Import des Routes
// const userRoute = require("./Routes/userRoute");
const documentRoute = require("./Routes/documentRoute");

// Middlewares globaux
app.use(cors());
app.use(express.json());

// Connexion à la base de données
mongoose
  .connect(dbUrl, {})
  .then(() => {
    console.log(`Connected to the MongoDB database!`);
    
    // On lance le serveur seulement si la DB est connectée
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch((err) => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });

// Déclaration des Routes
// app.use("/user", userRoute);
app.use("/document", documentRoute);

// Route de base pour tester le serveur
app.get("/", (req, res) => {
  res.send("API OCR & GridFS is running...");
});