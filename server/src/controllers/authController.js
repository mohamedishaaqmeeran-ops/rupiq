const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    currency: user.currency,
  };
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, currency } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2–100 characters",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

    if (password.length < 12 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 12–72 characters",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const allowedCurrencies = ["INR", "USD", "AED", "GBP", "EUR"];

    if (currency && !allowedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported currency",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      currency: currency || "INR",

      // Never accept role from req.body.
      // New registrations are always ordinary users.
      role: "user",
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    // Also handles duplicate-email races through MongoDB's unique index.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    // Use the same message for unknown emails and incorrect passwords.
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable",
      });
    }

    return res.status(200).json({
      success: true,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const { seedGuestData } = require("../services/guestSeedService");

exports.guest = async (req, res, next) => {
  try {
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const guestEmail = `guest_${Date.now()}_${uniqueId}@paisapilot.local`;
    const passwordHash = await bcrypt.hash(`guest_secret_${uniqueId}`, 10);

    const user = await User.create({
      name: "Guest Explorer",
      email: guestEmail,
      passwordHash,
      role: "guest",
      currency: "INR",
    });

    try {
      await seedGuestData(user._id);
    } catch (seedErr) {
      console.warn("Guest data seeding error (non-fatal):", seedErr.message);
    }

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Guest session initialized",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};