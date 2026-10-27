
const cron = require("node-cron");
const RecurringTransaction = require("../models/RecurringTransaction");
const Transaction = require("../models/Transaction");

function nextOccurrence(date, frequency) {
  const next = new Date(date);

  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (frequency === "monthly") {
    const originalDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);

    const lastDay = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0
    ).getDate();

    next.setDate(Math.min(originalDay, lastDay));
    return next;
  }

  if (frequency === "yearly") {
    const originalMonth = next.getMonth();
    const originalDay = next.getDate();

    next.setDate(1);
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(originalMonth);

    const lastDay = new Date(
      next.getFullYear(),
      originalMonth + 1,
      0
    ).getDate();

    next.setDate(Math.min(originalDay, lastDay));
    return next;
  }

  throw new Error(`Unsupported frequency: ${frequency}`);
}

async function processRecurringSchedule(schedule) {
  // Limit catch-up work for one schedule in a single run.
  for (let count = 0; count < 100; count += 1) {
    const current = await RecurringTransaction.findOne({
      _id: schedule._id,
      status: "active",
      nextRunAt: { $lte: new Date() },
    });

    if (!current) return;

    const occurrenceDate = new Date(current.nextRunAt);

    if (current.endDate && occurrenceDate > current.endDate) {
      await RecurringTransaction.updateOne(
        { _id: current._id, status: "active", nextRunAt: current.nextRunAt },
        { $set: { status: "cancelled" } }
      );
      return;
    }

    const occurrenceKey = `${current._id}:${occurrenceDate.toISOString()}`;

    try {
      await Transaction.create({
        user: current.user,
        type: current.type,
        amount: current.amount,
        category: current.category,
        description: current.description,
        date: occurrenceDate,
        recurringOccurrenceKey: occurrenceKey,
      });
    } catch (error) {
      // Another scheduler run may already have inserted this occurrence.
      // The unique index on recurringOccurrenceKey makes that safe.
      if (error.code !== 11000) throw error;
    }

    const nextRunAt = nextOccurrence(occurrenceDate, current.frequency);

    const update = {
      nextRunAt,
      lastGeneratedAt: occurrenceDate,
    };

    if (current.endDate && nextRunAt > current.endDate) {
      update.status = "cancelled";
    }

    // Conditional update avoids advancing a schedule another worker changed.
    const result = await RecurringTransaction.updateOne(
      {
        _id: current._id,
        status: "active",
        nextRunAt: occurrenceDate,
      },
      { $set: update }
    );

    if (result.modifiedCount === 0) return;

    if (update.status === "cancelled") return;
  }
}

async function runRecurringTransactionJob() {
  const dueSchedules = await RecurringTransaction.find({
    status: "active",
    nextRunAt: { $lte: new Date() },
  })
    .select("_id")
    .limit(500)
    .lean();

  for (const schedule of dueSchedules) {
    try {
      await processRecurringSchedule(schedule);
    } catch (error) {
      console.error(
        `Recurring transaction schedule ${schedule._id} failed:`,
        error.message
      );
    }
  }
}

function startRecurringTransactionScheduler() {
  // Run once at startup to process anything that became due while offline.
  runRecurringTransactionJob().catch((error) => {
    console.error("Initial recurring transaction job failed:", error);
  });

  // Then check every minute.
  cron.schedule("* * * * *", () => {
    runRecurringTransactionJob().catch((error) => {
      console.error("Recurring transaction job failed:", error);
    });
  });

  console.log("Recurring transaction scheduler started");
}

module.exports = { startRecurringTransactionScheduler };
