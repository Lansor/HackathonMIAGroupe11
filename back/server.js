require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const cookieParser = require("cookie-parser");
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
app.use(cookieParser());

// Connexion à la base de données
const PORT = process.env.SERVER_PORT || 8080;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const mongoose = require("mongoose");
const dbURL = process.env.DB_URL;
const dbUrl = `${dbURL}`;

const userRoute = require("./Routes/userRoute");
const userManagerRoute = require("./Routes/userManagerRoute");
const filesGeneratorsRoute = require("./Routes/filesGeneratorsRoute");
const {
  notFoundMiddleware,
  errorMiddleware,
} = require("./Middlewares/errorMiddleware");
//const documentRoute = require("./Routes/documentRoute");

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
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use("/user", userRoute);
app.use("/user-manager", userManagerRoute);
app.use("/files-generators", filesGeneratorsRoute);
//app.use("/document", documentRoute);

app.get("/", (_req, res) => {
  res.status(200).json({ message: "API is running" });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Route de base pour tester le serveur
app.get("/", (req, res) => {
  res.send("API OCR & GridFS is running...");
});