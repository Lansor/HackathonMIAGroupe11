const getFilesGenerators = async (_req, res) => {
  return res.status(200).json({
    message: "Route filesGenerators operationnelle.",
  });
};

module.exports = {
  getFilesGenerators,
};
