const express = require("express");
const router  = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const {
  getPlatformStats,
  listUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  cleanupGuests,
} = require("../controllers/adminController");

// All admin routes require authentication + admin or super_admin role
router.use(authenticate);
router.use(authorize("admin", "super_admin"));

// Platform stats
router.get("/stats", getPlatformStats);

// User management
router.get("/users",              listUsers);
router.get("/users/:id",          getUserById);
router.patch("/users/:id/role",   updateUserRole);
router.patch("/users/:id/status", updateUserStatus);
router.delete("/users/:id",       deleteUser);

// Guest cleanup (super_admin only handled in controller)
router.delete("/guests/cleanup",  cleanupGuests);

module.exports = router;
