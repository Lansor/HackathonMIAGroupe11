const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Models/userModel");

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const AUTH_COOKIE_NAME = "authToken";
const AUTH_COOKIE_MAX_AGE = Number(
  process.env.AUTH_COOKIE_MAX_AGE || 24 * 60 * 60 * 1000,
);

const sanitizeUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: AUTH_COOKIE_MAX_AGE,
});

const attachAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
};

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "username, email et password sont obligatoires.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Un utilisateur avec ce username ou email existe deja.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const token = createAccessToken(createdUser);
    attachAuthCookie(res, token);

    return res.status(201).json({
      message: "Utilisateur cree avec succes.",
      user: sanitizeUser(createdUser),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la creation de l'utilisateur.",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email et password sont obligatoires.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        message: "Identifiants invalides.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Identifiants invalides.",
      });
    }

    const token = createAccessToken(user);
    attachAuthCookie(res, token);

    return res.status(200).json({
      message: "Connexion reussie.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors du login.",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "email est obligatoire.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json({
        message:
          "Si un compte existe avec cet email, un lien de reinitialisation sera envoye.",
      });
    }

    return res.status(200).json({
      message:
        "Demande prise en compte. Configure l'envoi d'email pour finaliser la reinitialisation.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors du forgot password.",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email et password sont obligatoires.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: "Mot de passe mis a jour avec succes.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la reinitialisation du mot de passe.",
      error: error.message,
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const { sub } = req.auth || {};

    if (!sub) {
      return res.status(401).json({
        message: "Token invalide.",
      });
    }

    const user = await User.findById(sub);

    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    return res.status(200).json({
      message: "Utilisateur courant recupere.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la recuperation du profil.",
      error: error.message,
    });
  }
};

const logoutUser = (_req, res) => {
  clearAuthCookie(res);

  return res.status(200).json({
    message: "Deconnexion reussie.",
  });
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  logoutUser,
};
