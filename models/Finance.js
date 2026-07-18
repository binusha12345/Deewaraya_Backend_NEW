// server/models/Finance.js

const mongoose = require("mongoose");

const fishEntrySchema = new mongoose.Schema(
  {
    fishName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: "kg" },
    pricePerUnit: { type: Number, required: true },
    totalPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const expenseEntrySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "fuel",
        "driver_salary",
        "ice",
        "repair_maintenance",
        "equipment",
        "other",
      ],
      required: true,
    },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    fuelLiters: { type: Number, default: 0 },
  },
  { _id: false }
);

const dailyFinanceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    boatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Boat",
      required: false,
    },
    date: { type: Date, required: true },

    fishEntries: [fishEntrySchema],
    totalFishQuantity: { type: Number, default: 0 },
    totalIncome: { type: Number, default: 0 },

    expenses: [expenseEntrySchema],
    totalExpenses: { type: Number, default: 0 },

    netProfit: { type: Number, default: 0 },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// ✅ ASYNC Pre-save middleware - NO 'next' needed!
dailyFinanceSchema.pre("save", async function () {
  console.log("🟢 PRE-SAVE HOOK RUNNING");

  // Calculate fish totals
  if (this.fishEntries && this.fishEntries.length > 0) {
    this.fishEntries.forEach((fish) => {
      fish.totalPrice = (fish.quantity || 0) * (fish.pricePerUnit || 0);
    });

    this.totalFishQuantity = this.fishEntries.reduce(
      (sum, fish) => sum + (fish.quantity || 0),
      0
    );

    this.totalIncome = this.fishEntries.reduce(
      (sum, fish) => sum + (fish.totalPrice || 0),
      0
    );
  } else {
    this.totalFishQuantity = 0;
    this.totalIncome = 0;
  }

  // Calculate expense totals
  if (this.expenses && this.expenses.length > 0) {
    this.totalExpenses = this.expenses.reduce(
      (sum, exp) => sum + (exp.amount || 0),
      0
    );
  } else {
    this.totalExpenses = 0;
  }

  // Calculate net profit
  this.netProfit = this.totalIncome - this.totalExpenses;

  console.log("🟢 CALCULATED:");
  console.log("  Total Income:", this.totalIncome);
  console.log("  Total Expenses:", this.totalExpenses);
  console.log("  Net Profit:", this.netProfit);
});

// Indexes for faster queries
dailyFinanceSchema.index({ ownerId: 1, date: -1 });

module.exports = mongoose.model("DailyFinance", dailyFinanceSchema);