require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const documentRoute = require("./Routes/documentRoute");
const userRoute = require("./Routes/userRoute");
const userManagerRoute = require("./Routes/userManagerRoute");
const filesGeneratorsRoute = require("./Routes/filesGeneratorsRoute");
const {
  notFoundMiddleware,
  errorMiddleware,
} = require("./Middlewares/errorMiddleware");

const app = express();
const PORT = process.env.SERVER_PORT || 8080;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const dbUrl = process.env.DB_URL;

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use("/document", documentRoute);
app.use("/user", userRoute);
app.use("/user-manager", userManagerRoute);
app.use("/files-generators", filesGeneratorsRoute);

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "API OCR & GridFS is running...",
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

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
