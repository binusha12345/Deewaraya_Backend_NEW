// server/controllers/financeController.js

const DailyFinance = require("../models/Finance");
const PDFDocument = require("pdfkit");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail"); // ✅ Use Brevo utility

// ==================== DAILY ENTRIES ====================
exports.createDailyEntry = async (req, res) => {
  console.log("🚀 STEP 1: Entered createDailyEntry");

  try {
    console.log("🚀 STEP 2: Body:", JSON.stringify(req.body, null, 2));
    console.log("🚀 STEP 3: User:", req.user?._id);

    const { date, fishEntries, expenses, notes } = req.body;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    if (!fishEntries || fishEntries.length === 0) {
      return res.status(400).json({ message: "Fish entries required" });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Process fish entries
    console.log("🚀 STEP 4: Processing fish");
    const processedFish = fishEntries.map((f) => ({
      fishName: String(f.fishName || ""),
      quantity: Number(f.quantity) || 0,
      unit: f.unit || "kg",
      pricePerUnit: Number(f.pricePerUnit) || 0,
      totalPrice: (Number(f.quantity) || 0) * (Number(f.pricePerUnit) || 0),
    }));

    // Process expenses
    console.log("🚀 STEP 5: Processing expenses");
    const processedExpenses = [];
    if (expenses && Array.isArray(expenses)) {
      for (const e of expenses) {
        if (!e.amount) continue;

        const expObj = {
          category: e.category || "other",
          description: e.description || "",
          amount: Number(e.amount) || 0,
        };

        if (e.category === "fuel" && e.fuelLiters && !isNaN(e.fuelLiters)) {
          expObj.fuelLiters = Number(e.fuelLiters);
        }

        processedExpenses.push(expObj);
      }
    }

    console.log("🚀 STEP 6: Creating document");
    const entry = new DailyFinance({
      ownerId: req.user._id,
      date: new Date(date),
      fishEntries: processedFish,
      expenses: processedExpenses,
      notes: notes || "",
    });

    console.log("🚀 STEP 7: Saving to DB");
    const saved = await entry.save();
    console.log("✅ STEP 8: Saved with ID:", saved._id);

    res.status(201).json({
      success: true,
      message: "Daily entry created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("❌ SAVE CRASHED");
    console.error("❌ Name:", error.name);
    console.error("❌ Message:", error.message);
    console.error("❌ Full error:", error);
    if (error.errors) {
      console.error("❌ Validation errors:", JSON.stringify(error.errors, null, 2));
    }
    console.error("❌ Stack:", error.stack);

    res.status(500).json({
      message: error.message || "Server error",
      details: error.errors || null,
    });
  }
};

// Get all daily entries with filters
exports.getDailyEntries = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    let query = { ownerId: req.user._id };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const entries = await DailyFinance.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DailyFinance.countDocuments(query);

    res.json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get single daily entry
exports.getDailyEntryById = async (req, res) => {
  try {
    const entry = await DailyFinance.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update daily entry
exports.updateDailyEntry = async (req, res) => {
  try {
    const { fishEntries, expenses, notes } = req.body;

    const entry = await DailyFinance.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (fishEntries) {
      entry.fishEntries = fishEntries.map((fish) => ({
        ...fish,
        totalPrice: fish.quantity * fish.pricePerUnit,
      }));
    }
    if (expenses) entry.expenses = expenses;
    if (notes !== undefined) entry.notes = notes;

    await entry.save();

    res.json({
      success: true,
      message: "Entry updated successfully",
      data: entry,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete daily entry
exports.deleteDailyEntry = async (req, res) => {
  try {
    const entry = await DailyFinance.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.json({ success: true, message: "Entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ==================== MONTHLY REPORTS ====================

// Get monthly report
exports.getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const entries = await DailyFinance.find({
      ownerId: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    const monthlyData = entries.reduce(
      (acc, entry) => {
        acc.totalIncome += entry.totalIncome;
        acc.totalExpenses += entry.totalExpenses;
        acc.totalNetProfit += entry.netProfit;
        acc.totalFishQuantity += entry.totalFishQuantity;
        acc.workingDays += 1;

        entry.expenses.forEach((exp) => {
          acc.expenseBreakdown[exp.category] =
            (acc.expenseBreakdown[exp.category] || 0) + exp.amount;
        });

        entry.fishEntries.forEach((fish) => {
          if (!acc.fishBreakdown[fish.fishName]) {
            acc.fishBreakdown[fish.fishName] = { quantity: 0, income: 0 };
          }
          acc.fishBreakdown[fish.fishName].quantity += fish.quantity;
          acc.fishBreakdown[fish.fishName].income += fish.totalPrice;
        });

        return acc;
      },
      {
        totalIncome: 0,
        totalExpenses: 0,
        totalNetProfit: 0,
        totalFishQuantity: 0,
        workingDays: 0,
        expenseBreakdown: {},
        fishBreakdown: {},
      }
    );

    monthlyData.avgDailyIncome =
      monthlyData.workingDays > 0
        ? Math.round(monthlyData.totalIncome / monthlyData.workingDays)
        : 0;
    monthlyData.avgDailyExpense =
      monthlyData.workingDays > 0
        ? Math.round(monthlyData.totalExpenses / monthlyData.workingDays)
        : 0;
    monthlyData.avgDailyProfit =
      monthlyData.workingDays > 0
        ? Math.round(monthlyData.totalNetProfit / monthlyData.workingDays)
        : 0;
    monthlyData.profitMargin =
      monthlyData.totalIncome > 0
        ? ((monthlyData.totalNetProfit / monthlyData.totalIncome) * 100).toFixed(1)
        : 0;

    const recommendations = generateRecommendations(monthlyData);

    res.json({
      success: true,
      data: {
        month: parseInt(month),
        year: parseInt(year),
        entries,
        summary: monthlyData,
        recommendations,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Compare months
exports.getMonthlyComparison = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const now = new Date();
    const comparisonData = [];

    for (let i = 0; i < parseInt(months); i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        1
      );
      const endDate = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        0,
        23, 59, 59
      );

      const entries = await DailyFinance.find({
        ownerId: req.user._id,
        date: { $gte: startDate, $lte: endDate },
      });

      const totalIncome = entries.reduce((sum, e) => sum + e.totalIncome, 0);
      const totalExpenses = entries.reduce(
        (sum, e) => sum + e.totalExpenses,
        0
      );

      comparisonData.push({
        month: targetDate.getMonth() + 1,
        year: targetDate.getFullYear(),
        monthName: targetDate.toLocaleString("default", { month: "long" }),
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        workingDays: entries.length,
      });
    }

    res.json({
      success: true,
      data: comparisonData.reverse(),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ==================== PDF EMAIL ====================

exports.sendMonthlyPDFEmail = async (req, res) => {
  try {
    console.log("📧 STEP 1: Starting sendMonthlyPDFEmail");
    const { year, month } = req.body;

    const user = await User.findById(req.user._id);
    if (!user || !user.email) {
      return res.status(400).json({ message: "User email not found" });
    }
    console.log("📧 STEP 2: Sending to:", user.email);

    // Get monthly data
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const entries = await DailyFinance.find({
      ownerId: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    if (entries.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for this month" });
    }

    // Calculate summary
    const summary = entries.reduce(
      (acc, entry) => {
        acc.totalIncome += entry.totalIncome;
        acc.totalExpenses += entry.totalExpenses;
        acc.totalNetProfit += entry.netProfit;
        acc.workingDays += 1;

        entry.expenses.forEach((exp) => {
          acc.expenseBreakdown[exp.category] =
            (acc.expenseBreakdown[exp.category] || 0) + exp.amount;
        });

        entry.fishEntries.forEach((fish) => {
          if (!acc.fishBreakdown[fish.fishName]) {
            acc.fishBreakdown[fish.fishName] = { quantity: 0, income: 0 };
          }
          acc.fishBreakdown[fish.fishName].quantity += fish.quantity;
          acc.fishBreakdown[fish.fishName].income += fish.totalPrice;
        });

        return acc;
      },
      {
        totalIncome: 0,
        totalExpenses: 0,
        totalNetProfit: 0,
        workingDays: 0,
        expenseBreakdown: {},
        fishBreakdown: {},
      }
    );

    const recommendations = generateRecommendations(summary);
    const monthName = new Date(year, month - 1).toLocaleString("default", {
      month: "long",
    });

    // Generate PDF
    console.log("📧 STEP 3: Generating PDF");
    const pdfBuffer = await generatePDF(
      summary,
      recommendations,
      monthName,
      year,
      entries,
      user.name || "Boat Owner"
    );
    console.log("📧 STEP 4: PDF generated, size:", pdfBuffer.length, "bytes");

    // HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">📊 Monthly Finance Report</h2>
        <p>Dear ${user.name || "Boat Owner"},</p>
        <p>Please find attached your monthly finance report for 
           <strong>${monthName} ${year}</strong>.</p>
        
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="margin-top: 0;">Quick Summary</h3>
          <p>💰 Total Income: <strong>Rs. ${summary.totalIncome.toLocaleString()}</strong></p>
          <p>📉 Total Expenses: <strong>Rs. ${summary.totalExpenses.toLocaleString()}</strong></p>
          <p>📈 Net Profit: <strong style="color: ${summary.totalNetProfit >= 0 ? "green" : "red"};">
            Rs. ${summary.totalNetProfit.toLocaleString()}</strong></p>
          <p>🚤 Working Days: <strong>${summary.workingDays}</strong></p>
        </div>
        
        <p>Check the attached PDF for detailed analysis and recommendations.</p>
        <p>Best regards,<br>Deewaraya Finance Team</p>
      </div>
    `;

    // ✅ Send email using Brevo utility
    console.log("📧 STEP 5: Sending email via Brevo");
    await sendEmail({
      toEmail: user.email,
      subject: `Monthly Finance Report - ${monthName} ${year}`,
      htmlContent: htmlContent,
      attachments: [
        {
          filename: `Finance_Report_${monthName}_${year}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("✅ STEP 6: Email sent successfully!");

    res.json({
      success: true,
      message: `Report sent successfully to ${user.email}`,
    });
  } catch (error) {
    console.error("❌ Send PDF error:", error);
    res.status(500).json({
      message: "Failed to send report",
      error: error.message,
    });
  }
};

// ==================== DASHBOARD STATS ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23, 59, 59
    );

    const monthEntries = await DailyFinance.find({
      ownerId: req.user._id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const todayEntry = await DailyFinance.findOne({
      ownerId: req.user._id,
      date: {
        $gte: new Date(now.toISOString().split("T")[0]),
        $lt: new Date(
          new Date(now.toISOString().split("T")[0]).getTime() + 86400000
        ),
      },
    });

    const stats = {
      today: todayEntry
        ? {
            income: todayEntry.totalIncome,
            expenses: todayEntry.totalExpenses,
            profit: todayEntry.netProfit,
          }
        : null,
      monthly: {
        income: monthEntries.reduce((sum, e) => sum + e.totalIncome, 0),
        expenses: monthEntries.reduce((sum, e) => sum + e.totalExpenses, 0),
        profit: monthEntries.reduce((sum, e) => sum + e.netProfit, 0),
        workingDays: monthEntries.length,
      },
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

function generateRecommendations(data) {
  const recommendations = [];

  const profitMargin =
    data.totalIncome > 0
      ? (data.totalNetProfit / data.totalIncome) * 100
      : 0;

  if (profitMargin < 20) {
    recommendations.push({
      type: "warning",
      title: "Low Profit Margin",
      message: `Your profit margin is ${profitMargin.toFixed(1)}%. Consider reducing expenses or increasing fish prices to achieve at least 30% margin.`,
    });
  } else if (profitMargin > 40) {
    recommendations.push({
      type: "success",
      title: "Excellent Profit Margin",
      message: `Great job! Your profit margin is ${profitMargin.toFixed(1)}%. Consider reinvesting profits in equipment upgrades.`,
    });
  }

  const fuelExpense = data.expenseBreakdown?.fuel || 0;
  const fuelPercentage =
    data.totalExpenses > 0 ? (fuelExpense / data.totalExpenses) * 100 : 0;

  if (fuelPercentage > 40) {
    recommendations.push({
      type: "warning",
      title: "High Fuel Costs",
      message: `Fuel accounts for ${fuelPercentage.toFixed(1)}% of expenses. Consider optimizing routes, maintaining engine regularly, or exploring fuel-efficient practices.`,
    });
  }

  if (data.workingDays < 15) {
    recommendations.push({
      type: "info",
      title: "Low Working Days",
      message: `You only worked ${data.workingDays} days this month. If weather permits, increasing fishing days could boost income significantly.`,
    });
  }

  if (data.fishBreakdown) {
    const fishArr = Object.entries(data.fishBreakdown).sort(
      (a, b) => b[1].income - a[1].income
    );
    if (fishArr.length > 0) {
      recommendations.push({
        type: "success",
        title: "Top Earning Fish",
        message: `"${fishArr[0][0]}" is your highest earning fish with Rs. ${fishArr[0][1].income.toLocaleString()} income. Focus on catching more of this variety.`,
      });
    }
  }

  const repairCost = data.expenseBreakdown?.repair_maintenance || 0;
  if (repairCost > data.totalExpenses * 0.25) {
    recommendations.push({
      type: "warning",
      title: "High Repair Costs",
      message: `Repair costs are ${((repairCost / data.totalExpenses) * 100).toFixed(1)}% of expenses. Consider preventive maintenance to reduce unexpected repairs.`,
    });
  }

  if (data.totalNetProfit > 0) {
    recommendations.push({
      type: "info",
      title: "Savings Tip",
      message: `Consider saving 20% of your net profit (Rs. ${Math.round(data.totalNetProfit * 0.2).toLocaleString()}) for off-season or emergencies.`,
    });
  }

  return recommendations;
}

// ✅ PDF Generator function (EMOJIS REMOVED - prevents PDFKit crashes)
async function generatePDF(
  summary,
  recommendations,
  monthName,
  year,
  entries,
  ownerName
) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc.fontSize(24).fillColor("#1e3a5f").text("Deewaraya", { align: "center" });
    doc.fontSize(14).fillColor("#666").text("Monthly Finance Report", { align: "center" });
    doc.fontSize(12).text(`${monthName} ${year}`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Owner: ${ownerName}`, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });

    // Divider
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#1e3a5f");
    doc.moveDown();

    // Summary Section
    doc.fontSize(16).fillColor("#1e3a5f").text("Monthly Summary");
    doc.moveDown(0.5);

    const profitColor = summary.totalNetProfit >= 0 ? "#27ae60" : "#e74c3c";

    doc.fontSize(11).fillColor("#333");
    doc.text(`Total Income:         Rs. ${summary.totalIncome.toLocaleString()}`);
    doc.text(`Total Expenses:       Rs. ${summary.totalExpenses.toLocaleString()}`);
    doc.fillColor(profitColor);
    doc.text(`Net Profit:           Rs. ${summary.totalNetProfit.toLocaleString()}`);
    doc.fillColor("#333");
    doc.text(`Working Days:         ${summary.workingDays}`);
    doc.text(`Avg Daily Income:     Rs. ${Math.round(summary.totalIncome / (summary.workingDays || 1)).toLocaleString()}`);
    doc.text(`Profit Margin:        ${summary.totalIncome > 0 ? ((summary.totalNetProfit / summary.totalIncome) * 100).toFixed(1) : 0}%`);

    // Expense Breakdown
    doc.moveDown();
    doc.fontSize(16).fillColor("#1e3a5f").text("Expense Breakdown");
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333");

    const categoryLabels = {
      fuel: "Fuel",
      driver_salary: "Driver Salary",
      ice: "Ice",
      repair_maintenance: "Repair & Maintenance",
      equipment: "Equipment",
      other: "Other",
    };

    Object.entries(summary.expenseBreakdown).forEach(([category, amount]) => {
      const label = categoryLabels[category] || category;
      const percentage = ((amount / summary.totalExpenses) * 100).toFixed(1);
      doc.text(`${label}: Rs. ${amount.toLocaleString()} (${percentage}%)`);
    });

    // Fish Breakdown
    doc.moveDown();
    doc.fontSize(16).fillColor("#1e3a5f").text("Fish Income Breakdown");
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333");

    Object.entries(summary.fishBreakdown)
      .sort((a, b) => b[1].income - a[1].income)
      .forEach(([name, data]) => {
        doc.text(
          `${name}: ${data.quantity}kg - Rs. ${data.income.toLocaleString()}`
        );
      });

    // Daily Entries Table
    if (entries.length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor("#1e3a5f").text("Daily Entries");
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#333");

      doc.font("Helvetica-Bold");
      doc.text("Date          Income        Expenses      Profit", { continued: false });
      doc.font("Helvetica");
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#ccc");

      entries.forEach((entry) => {
        const dateStr = new Date(entry.date).toLocaleDateString();
        const profitStr = entry.netProfit >= 0 ? `+${entry.netProfit.toLocaleString()}` : entry.netProfit.toLocaleString();
        doc.text(
          `${dateStr}      Rs.${entry.totalIncome.toLocaleString().padEnd(10)}  Rs.${entry.totalExpenses.toLocaleString().padEnd(10)}  Rs.${profitStr}`
        );
      });
    }

    // Recommendations
    doc.addPage();
    doc.fontSize(16).fillColor("#1e3a5f").text("Recommendations");
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333");

    recommendations.forEach((rec, index) => {
      const icon =
        rec.type === "warning" ? "[!]" : rec.type === "success" ? "[OK]" : "[i]";
      doc.font("Helvetica-Bold").text(`${icon} ${rec.title}`);
      doc.font("Helvetica").text(rec.message);
      doc.moveDown(0.5);
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).fillColor("#999").text("This report is auto-generated by Deewaraya Finance System.", { align: "center" });
    doc.text("For any queries, contact support@deewaraya.com", { align: "center" });

    doc.end();
  });
}