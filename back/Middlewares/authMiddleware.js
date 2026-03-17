const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Token manquant. Utilise Authorization: Bearer <token>.",
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({
      message: "Token invalide ou expire.",
    });
  }
};

const normalizeAuthBody = (req, _res, next) => {
  const body = req.body || {};

  if (typeof body.email === "string") {
    body.email = body.email.trim().toLowerCase();
  }

  if (typeof body.username === "string") {
    body.username = body.username.trim();
  }

  if (typeof body.password === "string") {
    body.password = body.password.trim();
  }

  req.body = body;
  next();
};

const validateRegisterBody = (req, res, next) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      message: "username, email et password sont obligatoires.",
    });
  }

  if (username.length < 2) {
    return res.status(400).json({
      message: "username doit contenir au moins 2 caracteres.",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "Format d'email invalide.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: "password doit contenir au moins 8 caracteres.",
    });
  }

  return next();
};

const validateLoginBody = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "email et password sont obligatoires.",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "Format d'email invalide.",
    });
  }

  return next();
};

const validateForgotPasswordBody = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "email est obligatoire.",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "Format d'email invalide.",
    });
  }

  return next();
};

const validateResetPasswordBody = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "email et password sont obligatoires.",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "Format d'email invalide.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: "password doit contenir au moins 8 caracteres.",
    });
  }

  return next();
};

module.exports = {
  requireAuth,
  normalizeAuthBody,
  validateRegisterBody,
  validateLoginBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
};
