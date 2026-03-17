const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../Middlewares/authMiddleware");
const {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
} = require("../Controllers/userManagerController");

// Toutes les routes exigent d'être connecté ET d'avoir le role admin
router.use(requireAuth, requireAdmin);

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.patch("/:id/role", updateUserRole);
router.delete("/:id", deleteUser);

module.exports = router;
