const { parse } = require("csv-parse/sync");
const crypto = require("crypto");
const Transaction = require("../models/Transaction");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseAmount(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const cleaned = String(value)
    .replace(/[₹$,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseDate(value) {
  const text = String(value || "").trim();

  if (!text) return null;

  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);

  if (iso) {
    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      12
    );

    if (
      date.getFullYear() === Number(iso[1]) &&
      date.getMonth() === Number(iso[2]) - 1 &&
      date.getDate() === Number(iso[3])
    ) {
      return date;
    }
  }

  // ISO timestamp submitted by the review screen.
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const timestamp = new Date(text);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY.
  // Ambiguous numeric dates are interpreted as DD/MM/YYYY.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);

  if (dmy) {
    let year = Number(dmy[3]);

    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    const day = Number(dmy[1]);
    const month = Number(dmy[2]);

    const date = new Date(year, month - 1, day, 12);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  return null;
}

function classify(description, type) {
  if (type === "income") {
    if (/salary|payroll|wage/i.test(description)) {
      return "Salary";
    }

    if (/freelance|consult/i.test(description)) {
      return "Freelance";
    }

    return "Other";
  }

  if (
    /restaurant|swiggy|zomato|grocery|supermarket|food/i.test(description)
  ) {
    return "Food";
  }

  if (
    /uber|ola|metro|bus|train|fuel|petrol|transport/i.test(description)
  ) {
    return "Transport";
  }

  if (/amazon|flipkart|shopping|store/i.test(description)) {
    return "Shopping";
  }

  if (
    /electricity|water bill|internet|mobile bill|utility/i.test(description)
  ) {
    return "Bills";
  }

  if (/pharmacy|hospital|medical|health/i.test(description)) {
    return "Health";
  }

  return "Other";
}

function createImportHash({ date, type, amount, description }) {
  const normalizedDescription = String(description || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return crypto
    .createHash("sha256")
    .update(
      [
        new Date(date).toISOString().slice(0, 10),
        type,
        Number(amount).toFixed(2),
        normalizedDescription,
      ].join("|")
    )
    .digest("hex");
}

function getUserId(req) {
  return req.user?.id || req.user?._id || req.user?.userId;
}

function parseCsvRows(content) {
  return parse(content, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false,
    columns: (headers) => headers.map(normalizeHeader),
  });
}

exports.importCsvStatement = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Upload a CSV file.",
      });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(413).json({
        success: false,
        message: "CSV file must be 5 MB or smaller.",
      });
    }

    const filename = String(
      req.file.originalname || ""
    ).toLowerCase();

    if (!filename.endsWith(".csv")) {
      return res.status(400).json({
        success: false,
        message: "Only CSV files are supported.",
      });
    }

    const content = req.file.buffer
      .toString("utf8")
      .replace(/^\uFEFF/, "");

    let rows;

    try {
      rows = parseCsvRows(content);
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Could not read this CSV. Check its format and headers.",
      });
    }

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "The CSV has no transaction rows.",
      });
    }

    if (rows.length > MAX_ROWS) {
      return res.status(400).json({
        success: false,
        message: `A maximum of ${MAX_ROWS} rows can be imported at once.`,
      });
    }

    const keys = Object.keys(rows[0]);

    const dateKey = keys.find((key) =>
      [
        "date",
        "transactiondate",
        "valuedate",
        "postingdate",
      ].includes(key)
    );

    const descriptionKey = keys.find((key) =>
      [
        "description",
        "narration",
        "details",
        "remarks",
        "transactiondetails",
        "particulars",
      ].includes(key)
    );

    const debitKey = keys.find((key) =>
      [
        "debit",
        "withdrawal",
        "withdrawals",
        "moneyout",
      ].includes(key)
    );

    const creditKey = keys.find((key) =>
      [
        "credit",
        "deposit",
        "deposits",
        "moneyin",
      ].includes(key)
    );

    const amountKey = keys.find((key) =>
      ["amount", "transactionamount"].includes(key)
    );

    const typeKey = keys.find((key) =>
      ["type", "transactiontype", "drcr"].includes(key)
    );

    if (
      !dateKey ||
      !descriptionKey ||
      (!amountKey && !debitKey && !creditKey)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Required columns not found. Include Date, Description/Narration, and Amount or Debit/Credit columns.",
        detectedHeaders: keys,
      });
    }

    const valid = [];
    const rejected = [];

    rows.forEach((row, index) => {
      const date = parseDate(row[dateKey]);
      const description = String(
        row[descriptionKey] || ""
      ).trim();

      let amount = null;
      let type = null;

      const debit = debitKey
        ? parseAmount(row[debitKey])
        : null;

      const credit = creditKey
        ? parseAmount(row[creditKey])
        : null;

      if (debitKey || creditKey) {
        if ((debit || 0) > 0 && (credit || 0) > 0) {
          rejected.push({
            row: index + 2,
            reason:
              "Both debit and credit are populated.",
          });

          return;
        }

        if ((debit || 0) > 0) {
          amount = debit;
          type = "expense";
        } else if ((credit || 0) > 0) {
          amount = credit;
          type = "income";
        }
      } else {
        amount = parseAmount(row[amountKey]);

        const rawType = String(
          typeKey ? row[typeKey] : ""
        ).toLowerCase();

        if (amount !== null && amount < 0) {
          amount = Math.abs(amount);
          type = "expense";
        } else if (
          /\b(debit|withdrawal|expense|dr)\b/.test(rawType)
        ) {
          type = "expense";
        } else if (
          /\b(credit|deposit|income|cr)\b/.test(rawType)
        ) {
          type = "income";
        }
      }

      if (
        !date ||
        !description ||
        !amount ||
        amount <= 0 ||
        !type
      ) {
        rejected.push({
          row: index + 2,
          reason:
            "Invalid date, description, amount, or transaction type.",
        });

        return;
      }

      const transaction = {
        date,
        description: description.slice(0, 250),
        amount,
        type,
        category: classify(description, type),
      };

      transaction.importHash = createImportHash(transaction);

      valid.push(transaction);
    });

    // Remove duplicate rows within the uploaded CSV.
    const unique = [];
    const seen = new Set();

    for (const item of valid) {
      if (seen.has(item.importHash)) continue;

      seen.add(item.importHash);
      unique.push(item);
    }

    // Check existing imports belonging to this user only.
    const existingHashes = unique.length
      ? await Transaction.find({
          user: userId,
          importHash: {
            $in: unique.map((item) => item.importHash),
          },
        }).distinct("importHash")
      : [];

    const existingSet = new Set(existingHashes);

    const newTransactions = unique.filter(
      (item) => !existingSet.has(item.importHash)
    );

    // PREVIEW MODE
    if (String(req.body.confirm).toLowerCase() !== "true") {
      return res.json({
        success: true,
        preview: true,
        totalRows: rows.length,
        validRows: valid.length,
        uniqueRows: unique.length,
        duplicateRows:
          valid.length - unique.length + existingHashes.length,
        rejectedRows: rejected,
        transactions: newTransactions,
      });
    }

    // CONFIRMATION MODE
    // Use the reviewed list sent by the mobile app.
    let reviewed;

    try {
      reviewed = JSON.parse(req.body.transactions || "null");
    } catch {
      return res.status(400).json({
        success: false,
        message: "Reviewed transactions must be valid JSON.",
      });
    }

    if (
      !Array.isArray(reviewed) ||
      reviewed.length > MAX_ROWS
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a valid list of reviewed transactions.",
      });
    }

    const reviewedTransactions = [];

    for (let index = 0; index < reviewed.length; index += 1) {
      const item = reviewed[index];

      const amount = Number(item?.amount);
      const type = item?.type;

      const category =
        typeof item?.category === "string"
          ? item.category.trim()
          : "";

      const description =
        typeof item?.description === "string"
          ? item.description.trim()
          : "";

      const date = parseDate(item?.date);

      if (
        !date ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !["income", "expense"].includes(type) ||
        !category ||
        category.length > 60 ||
        description.length > 250
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Reviewed transaction ${index + 1} has invalid fields.`,
        });
      }

      const transaction = {
        date,
        type,
        amount,
        category,
        description,
      };

      // Recalculate hash on the server.
      transaction.importHash = createImportHash(transaction);

      reviewedTransactions.push(transaction);
    }

    // Remove duplicates within the reviewed list.
    const reviewedUnique = [];
    const reviewedSeen = new Set();

    for (const item of reviewedTransactions) {
      if (reviewedSeen.has(item.importHash)) continue;

      reviewedSeen.add(item.importHash);
      reviewedUnique.push(item);
    }

    // Check the database again at confirmation time.
    const reviewedExistingHashes = reviewedUnique.length
      ? await Transaction.find({
          user: userId,
          importHash: {
            $in: reviewedUnique.map((item) => item.importHash),
          },
        }).distinct("importHash")
      : [];

    const reviewedExistingSet = new Set(
      reviewedExistingHashes
    );

    const toInsert = reviewedUnique.filter(
      (item) => !reviewedExistingSet.has(item.importHash)
    );

    let imported = 0;

    if (toInsert.length) {
      try {
        const saved = await Transaction.insertMany(
          toInsert.map((item) => ({
            ...item,
            user: userId,
          })),
          { ordered: false }
        );

        imported = saved.length;
      } catch (error) {
        // Duplicate-key races can happen if two imports run at once.
        if (error.code !== 11000 && !error.writeErrors) {
          throw error;
        }

        imported = error.insertedDocs?.length || 0;
      }
    }

    return res.json({
      success: true,
      preview: false,
      imported,
      duplicateRows:
        reviewedTransactions.length -
        reviewedUnique.length +
        reviewedExistingHashes.length,
      rejectedRows: rejected,
      message: `${imported} transaction(s) imported.`,
    });
  } catch (error) {
    next(error);
  }
};