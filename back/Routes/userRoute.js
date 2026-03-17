const express = require("express");
const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getCurrentUser,
} = require("../Controllers/userController");
const {
  requireAuth,
  normalizeAuthBody,
  validateRegisterBody,
  validateLoginBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
} = require("../Middlewares/authMiddleware");

const router = express.Router();

router.post("/register", normalizeAuthBody, validateRegisterBody, registerUser);
router.post("/login", normalizeAuthBody, validateLoginBody, loginUser);
router.post(
  "/forgot-password",
  normalizeAuthBody,
  validateForgotPasswordBody,
  forgotPassword,
);
router.post(
  "/reset-password",
  normalizeAuthBody,
  validateResetPasswordBody,
  resetPassword,
);
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
