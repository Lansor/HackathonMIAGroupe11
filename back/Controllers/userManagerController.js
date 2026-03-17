const User = require("../Models/userModel");

const sanitizeUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

// GET /user-manager  — liste tous les utilisateurs
const getAllUsers = async (_req, res) => {
  try {
    const users = await User.find({}, "-password");
    return res.status(200).json({
      message: "Liste des utilisateurs recuperee.",
      users: users.map(sanitizeUser),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la recuperation des utilisateurs.",
      error: error.message,
    });
  }
};

// GET /user-manager/:id  — recupere un utilisateur par son id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, "-password");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }
    return res.status(200).json({
      message: "Utilisateur recupere.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la recuperation de l'utilisateur.",
      error: error.message,
    });
  }
};

// PATCH /user-manager/:id/role  — modifie le role d'un utilisateur
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({
        message: "role doit valoir 'user' ou 'admin'.",
      });
    }

    // Empêche un admin de révoquer son propre rôle
    if (String(req.params.id) === String(req.auth.sub)) {
      return res.status(400).json({
        message: "Vous ne pouvez pas modifier votre propre role.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    return res.status(200).json({
      message: "Role mis a jour.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la mise a jour du role.",
      error: error.message,
    });
  }
};

// DELETE /user-manager/:id  — supprime un utilisateur
const deleteUser = async (req, res) => {
  try {
    // Empêche un admin de se supprimer lui-même
    if (String(req.params.id) === String(req.auth.sub)) {
      return res.status(400).json({
        message:
          "Vous ne pouvez pas supprimer votre propre compte depuis ce endpoint.",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    return res.status(200).json({
      message: "Utilisateur supprime.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur lors de la suppression de l'utilisateur.",
      error: error.message,
    });
  }
};

module.exports = { getAllUsers, getUserById, updateUserRole, deleteUser };
