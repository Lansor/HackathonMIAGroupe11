require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
app.use(express.json());
app.use(cookieParser());

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
  })
  .catch((err) => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });

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
