const notFoundMiddleware = (req, res, _next) => {
  return res.status(404).json({
    message: `Route introuvable: ${req.method} ${req.originalUrl}`,
  });
};

const errorMiddleware = (err, _req, res, _next) => {
  console.error("Unhandled error:", err);

  return res.status(err.status || 500).json({
    message: err.message || "Erreur serveur interne.",
  });
};

module.exports = {
  notFoundMiddleware,
  errorMiddleware,
};
