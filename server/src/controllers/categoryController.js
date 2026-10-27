
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");

const ALLOWED_TYPES = ["income", "expense"];

const DEFAULT_CATEGORIES = {
  income: [
    { name: "Salary", icon: "wallet", color: "#16a34a" },
    { name: "Freelance", icon: "laptop", color: "#0891b2" },
    { name: "Investment", icon: "trending-up", color: "#7c3aed" },
    { name: "Other Income", icon: "plus-circle", color: "#64748b" },
  ],
  expense: [
    { name: "Food", icon: "utensils", color: "#f97316" },
    { name: "Transport", icon: "car", color: "#0284c7" },
    { name: "Shopping", icon: "shopping-bag", color: "#db2777" },
    { name: "Bills", icon: "receipt", color: "#ca8a04" },
    { name: "Health", icon: "heart-pulse", color: "#dc2626" },
    { name: "Housing", icon: "house", color: "#7c3aed" },
    { name: "Education", icon: "book-open", color: "#0d9488" },
    { name: "Other", icon: "wallet", color: "#64748b" },
  ],
};

function getUserId(req) {
  return req.user?.id || req.user?._id;
}

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/categories
exports.getCategories = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { type } = req.query;

    if (type && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be income or expense",
      });
    }

    const filter = { user: userId };
    if (type) filter.type = type;

    const categories = await Category.find(filter).sort({
      type: 1,
      name: 1,
    });

    return res.json({ success: true, categories });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// POST /api/categories
exports.createCategory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, type, icon, color } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be at most 50 characters",
      });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be income or expense",
      });
    }

    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({
        success: false,
        message: "Color must be a valid hex color, e.g. #16a34a",
      });
    }

    const normalizedName = name.trim();

    const existing = await Category.findOne({
      user: userId,
      type,
      name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    const category = await Category.create({
      user: userId,
      name: normalizedName,
      type,
      icon: typeof icon === "string" && icon.trim() ? icon.trim() : "wallet",
      color: color || "#64748b",
      isDefault: false,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A category with this name and type already exists",
      });
    }

    console.error("Create category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// PUT /api/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { name, type, icon, color } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!validateObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await Category.findOne({ _id: id, user: userId });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (category.isDefault) {
      return res.status(403).json({
        success: false,
        message: "Default categories cannot be edited",
      });
    }

    const nextName =
      name === undefined
        ? category.name
        : typeof name === "string"
          ? name.trim()
          : "";

    const nextType = type === undefined ? category.type : type;

    if (!nextName || nextName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be at most 50 characters",
      });
    }

    if (!ALLOWED_TYPES.includes(nextType)) {
      return res.status(400).json({
        success: false,
        message: "Type must be income or expense",
      });
    }

    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({
        success: false,
        message: "Color must be a valid hex color",
      });
    }

    const duplicate = await Category.findOne({
      _id: { $ne: category._id },
      user: userId,
      type: nextType,
      name: { $regex: `^${nextName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    const oldType = category.type;

    category.name = nextName;
    category.type = nextType;

    if (icon !== undefined) {
      if (typeof icon !== "string" || !icon.trim()) {
        return res.status(400).json({
          success: false,
          message: "Icon must be a non-empty string",
        });
      }
      category.icon = icon.trim();
    }

    if (color !== undefined) category.color = color;

    // Do not allow changing category type while transactions use it.
    if (oldType !== nextType) {
      const inUse = await Transaction.exists({
        user: userId,
        category: category.name,
      });

      if (inUse) {
        return res.status(409).json({
          success: false,
          message: "Cannot change category type while transactions use this category",
        });
      }
    }

    await category.save();

    return res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A category with this name and type already exists",
      });
    }

    console.error("Update category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!validateObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await Category.findOne({ _id: id, user: userId });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (category.isDefault) {
      return res.status(403).json({
        success: false,
        message: "Default categories cannot be deleted",
      });
    }

    // Transaction currently stores category as a string.
    const inUse = await Transaction.exists({
      user: userId,
      category: category.name,
    });

    if (inUse) {
      return res.status(409).json({
        success: false,
        message: "This category is used by transactions. Reassign those transactions first.",
      });
    }

    await category.deleteOne();

    return res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};

// POST /api/categories/seed-defaults
// Creates default categories for the currently authenticated user.
exports.seedDefaultCategories = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const operations = Object.entries(DEFAULT_CATEGORIES).flatMap(
      ([type, items]) =>
        items.map((item) => ({
          updateOne: {
            filter: {
              user: userId,
              type,
              name: item.name,
            },
            update: {
              $setOnInsert: {
                user: userId,
                type,
                name: item.name,
                icon: item.icon,
                color: item.color,
                isDefault: true,
              },
            },
            upsert: true,
          },
        }))
    );

    await Category.bulkWrite(operations, { ordered: false });

    const categories = await Category.find({ user: userId }).sort({
      type: 1,
      name: 1,
    });

    return res.json({
      success: true,
      message: "Default categories initialized",
      categories,
    });
  } catch (error) {
    console.error("Seed default categories error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initialize default categories",
    });
  }
};
