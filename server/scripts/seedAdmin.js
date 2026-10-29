/**
 * PaisaPilot – Admin Seed Script
 * ─────────────────────────────────────────────
 * Creates or upgrades a user to super_admin.
 *
 * Usage:
 *   node scripts/seedAdmin.js
 *
 * Environment variables read from ../.env (server root)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const ADMIN_NAME     = "PaisaPilot Admin";
const ADMIN_EMAIL    = "admin@paisapilot.local";
const ADMIN_PASSWORD = "Admin@PaisaPilot#2026"; // min 12 chars – change after first login!

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");

  console.log("🔗 Connecting to MongoDB…");
  await mongoose.connect(uri);
  console.log("✅ Connected\n");

  // Load User model
  const User = require("../src/models/User");

  let user = await User.findOne({ email: ADMIN_EMAIL });

  if (user) {
    // Upgrade existing user to super_admin
    await User.findByIdAndUpdate(user._id, { $set: { role: "super_admin", status: "active" } });
    console.log(`♻️  Existing account upgraded to super_admin:`);
    console.log(`   Email : ${ADMIN_EMAIL}`);
    console.log(`   Role  : super_admin`);
  } else {
    // Create fresh admin account
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    user = await User.create({
      name:         ADMIN_NAME,
      email:        ADMIN_EMAIL,
      passwordHash,
      currency:     "INR",
      // role is immutable on schema; bypass with direct model call:
    });
    // Force role update since schema has immutable: true
    await User.findByIdAndUpdate(user._id, { $set: { role: "super_admin" } });
    console.log(`🎉 Admin account created!`);
    console.log(`   Name  : ${ADMIN_NAME}`);
    console.log(`   Email : ${ADMIN_EMAIL}`);
    console.log(`   Pass  : ${ADMIN_PASSWORD}`);
  }

  console.log("\n⚠️  Change the password after your first login!");
  console.log("👉 Log in with the above credentials in the PaisaPilot app.\n");

  await mongoose.disconnect();
  console.log("🔌 Disconnected. Done!");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
