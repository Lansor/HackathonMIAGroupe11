const express = require("express");
const {
  getFilesGenerators,
} = require("../Controllers/filesGeneratorsController");

const router = express.Router();

router.get("/", getFilesGenerators);

module.exports = router;
