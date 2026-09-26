const DailyFinance = require("../models/Finance");
const PDFDocument = require("pdfkit");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail"); // ✅ Use Brevo utility
// Whatsapp Apoi
const { sendWhatsAppPDF, sendWhatsAppText } = require("../utils/whatsappService");
const path = require("path");
const fs = require("fs");

const normalizeWhatsappNumber = (value) =>
  String(value || "").replace(/[\s\-()]/g, "");

const getPublicReportBaseUrl = () => {
  const configuredUrl = process.env.PUBLIC_BASE_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "WhatsApp PDF delivery is not configured. Set PUBLIC_BASE_URL to the public HTTPS URL of the server."
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("PUBLIC_BASE_URL must be a valid public HTTPS URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("PUBLIC_BASE_URL must use HTTPS so Twilio can download the PDF.");
  }

  return parsedUrl.toString().replace(/\/$/, "");
};

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

// ==================== PDF WHATSAPP ====================

exports.sendMonthlyReportWhatsApp = async (req, res) => {
  try {
    console.log("📱 STEP 1: Starting sendMonthlyReportWhatsApp");
    const { year, month, whatsappNumber } = req.body;
    const normalizedWhatsappNumber = normalizeWhatsappNumber(whatsappNumber);

    // --- Validate WhatsApp number ---
    if (!normalizedWhatsappNumber) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp number is required",
      });
    }

    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!phoneRegex.test(normalizedWhatsappNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Use +[country code][number], e.g. +94771234567",
      });
    }

    let publicReportBaseUrl;
    try {
      publicReportBaseUrl = getPublicReportBaseUrl();
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: error.message,
      });
    }

    // --- Fetch user ---
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    // --- Fetch monthly data ---
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const entries = await DailyFinance.find({
      ownerId: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    if (entries.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found for this month",
      });
    }

    // --- Calculate summary (same logic as email) ---
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

    console.log("📱 STEP 2: Generating PDF for WhatsApp");

    // --- Generate PDF (reuse existing function) ---
    const pdfBuffer = await generatePDF(
      summary,
      recommendations,
      monthName,
      year,
      entries,
      user.name || "Boat Owner"
    );

    console.log("📱 STEP 3: PDF generated, size:", pdfBuffer.length, "bytes");

    // --- Save PDF temporarily to public folder ---
    const reportsDir = path.join(__dirname, "../public/reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `monthly-report-${year}-${month}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    console.log("📱 STEP 4: PDF saved to:", filePath);

    // --- Build public URL for Twilio to fetch ---
    const pdfUrl = `${publicReportBaseUrl}/reports/${fileName}`;

    console.log("📱 STEP 5: PDF public URL:", pdfUrl);

    // --- Compose WhatsApp message ---
    const profitEmoji = summary.totalNetProfit >= 0 ? "📈" : "📉";
    const message =
      `*Deewaraya - Monthly Finance Report*\n\n` +
      `📅 Period: ${monthName} ${year}\n` +
      `💰 Total Income: Rs. ${summary.totalIncome.toLocaleString()}\n` +
      `💸 Total Expenses: Rs. ${summary.totalExpenses.toLocaleString()}\n` +
      `${profitEmoji} Net Profit: Rs. ${summary.totalNetProfit.toLocaleString()}\n` +
      `🚤 Working Days: ${summary.workingDays}\n` +
      `📊 Profit Margin: ${summary.totalIncome > 0 ? ((summary.totalNetProfit / summary.totalIncome) * 100).toFixed(1) : 0}%\n\n` +
      `The detailed PDF report is attached below.`;

    // --- Send via Twilio WhatsApp ---
    console.log("📱 STEP 6: Sending WhatsApp to:", normalizedWhatsappNumber);
    await sendWhatsAppPDF(normalizedWhatsappNumber, pdfUrl, message);

    console.log("✅ STEP 7: WhatsApp sent successfully!");

    // --- Cleanup: delete temp PDF after 10 minutes ---
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🗑️ Temp PDF deleted:", fileName);
      }
    }, 10 * 60 * 1000);

    res.status(200).json({
      success: true,
      message: "Monthly report sent to WhatsApp successfully!",
    });
  } catch (error) {
    console.error("❌ Send WhatsApp error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send WhatsApp report",
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

// PDF Generator
async function generatePDF(
  summary,
  recommendations,
  monthName,
  year,
  entries,
  ownerName
) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
    const buffers = [];
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 88;
    const colors = {
      navy: "#1E3A8A",
      blue: "#2563EB",
      teal: "#0891B2",
      green: "#10B981",
      red: "#EF4444",
      ink: "#1E293B",
      muted: "#64748B",
      line: "#CBD5E1",
      paleBlue: "#EFF6FF",
      paleGreen: "#ECFDF5",
      paleRed: "#FEF2F2",
      paleGold: "#ECFEFF",
      white: "#FFFFFF",
    };
    const money = (value) => `Rs. ${Math.round(value || 0).toLocaleString()}`;
    const percentage = (value, total) =>
      total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
    const profitColor = summary.totalNetProfit >= 0 ? colors.green : colors.red;
    const margin =
      summary.totalIncome > 0
        ? (summary.totalNetProfit / summary.totalIncome) * 100
        : 0;
    let pageNumber = 1;

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const categoryLabels = {
      fuel: "Fuel",
      driver_salary: "Driver Salary",
      ice: "Ice",
      repair_maintenance: "Repair & Maintenance",
      equipment: "Equipment",
      other: "Other",
    };

    const drawFooter = () => {
      doc.save();
      doc.strokeColor(colors.line).lineWidth(0.7)
        .moveTo(44, pageHeight - 76).lineTo(pageWidth - 44, pageHeight - 76).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(colors.muted)
        .text("Deewaraya Finance | Confidential owner report", 44, pageHeight - 65, { width: 330 });
      doc.text(`Page ${pageNumber}`, pageWidth - 100, pageHeight - 65, { width: 56, align: "right" });
      doc.restore();
    };

    const drawPageHeader = (sectionTitle) => {
      doc.rect(0, 0, pageWidth, 78).fill(colors.navy);
      doc.font("Helvetica-Bold").fontSize(22).fillColor(colors.white)
        .text("DEEWARAYA", 44, 22, { characterSpacing: 1.2 });
      doc.font("Helvetica").fontSize(9).fillColor("#B9D5E5")
        .text("MARITIME FINANCE MANAGEMENT", 45, 49, { characterSpacing: 1.1 });
      doc.font("Helvetica-Bold").fontSize(11).fillColor(colors.white)
        .text(sectionTitle.toUpperCase(), pageWidth - 220, 32, { width: 176, align: "right" });
      doc.y = 104;
    };

    const sectionTitle = (title, subtitle) => {
      doc.font("Helvetica-Bold").fontSize(16).fillColor(colors.navy).text(title);
      if (subtitle) {
        doc.font("Helvetica").fontSize(9).fillColor(colors.muted).text(subtitle, { continued: false });
      }
      doc.moveDown(0.65);
    };

    const metricCard = (x, y, width, label, value, accent, fill) => {
      doc.roundedRect(x, y, width, 73, 8).fillAndStroke(fill, colors.line);
      doc.rect(x, y, 5, 73).fill(accent);
      doc.font("Helvetica").fontSize(9).fillColor(colors.muted).text(label.toUpperCase(), x + 16, y + 14, { width: width - 25 });
      doc.font("Helvetica-Bold").fontSize(15).fillColor(colors.ink).text(value, x + 16, y + 35, { width: width - 25 });
    };

    const drawBreakdown = (title, items, total, itemValue) => {
      sectionTitle(title, "A clear view of where the month's money came from or went.");
      if (items.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(colors.muted).text("No records available for this period.");
        return;
      }
      const barWidth = 188;
      items.forEach(([label, value], index) => {
        const y = doc.y;
        const amount = itemValue(value);
        const share = total > 0 ? amount / total : 0;
        doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(label, 44, y, { width: 145 });
        doc.font("Helvetica").fontSize(9).fillColor(colors.muted).text(`${money(amount)}  |  ${percentage(amount, total)}`, 280, y, { width: 105, align: "right" });
        doc.roundedRect(44, y + 17, barWidth, 7, 3).fill("#E7EEF3");
        doc.roundedRect(44, y + 17, Math.max(share * barWidth, share > 0 ? 4 : 0), 7, 3).fill(index % 2 ? colors.teal : colors.blue);
        doc.y = y + 36;
      });
    };

    drawPageHeader("Monthly Finance Report");
    doc.font("Helvetica-Bold").fontSize(25).fillColor(colors.navy).text(`${monthName} ${year}`);
    doc.font("Helvetica").fontSize(10).fillColor(colors.muted).text(`Prepared for ${ownerName}  |  Generated ${new Date().toLocaleDateString()}`);
    doc.moveDown(1.2);

    sectionTitle("Executive Summary", "Your financial performance at a glance.");
    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap) / 2;
    const firstRowY = doc.y;
    metricCard(44, firstRowY, cardWidth, "Total income", money(summary.totalIncome), colors.blue, colors.paleBlue);
    metricCard(44 + cardWidth + cardGap, firstRowY, cardWidth, "Total expenses", money(summary.totalExpenses), colors.red, colors.paleRed);
    metricCard(44, firstRowY + 84, cardWidth, "Net profit", money(summary.totalNetProfit), profitColor, summary.totalNetProfit >= 0 ? colors.paleGreen : colors.paleRed);
    metricCard(44 + cardWidth + cardGap, firstRowY + 84, cardWidth, "Profit margin", `${margin.toFixed(1)}%`, colors.teal, colors.paleGold);
    doc.y = firstRowY + 184;

    const detailY = doc.y;
    doc.roundedRect(44, detailY, contentWidth, 59, 8).fillAndStroke("#F6F9FB", colors.line);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.navy).text("OPERATING SNAPSHOT", 58, detailY + 14);
    doc.font("Helvetica").fontSize(10).fillColor(colors.ink)
      .text(`Working days: ${summary.workingDays}`, 58, detailY + 33)
      .text(`Average daily income: ${money(summary.totalIncome / (summary.workingDays || 1))}`, 190, detailY + 33)
      .text(`Average daily expense: ${money(summary.totalExpenses / (summary.workingDays || 1))}`, 386, detailY + 33);
    doc.y = detailY + 86;

    const expenseItems = Object.entries(summary.expenseBreakdown || {})
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => [categoryLabels[category] || category, amount]);
    drawBreakdown("Expense Breakdown", expenseItems, summary.totalExpenses, (value) => value);

    doc.addPage();
    pageNumber += 1;
    drawPageHeader("Income Analysis");
    const fishItems = Object.entries(summary.fishBreakdown || {})
      .sort((a, b) => b[1].income - a[1].income);
    sectionTitle("Income by Catch", "Revenue contribution from each recorded fish category.");
    if (fishItems.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(colors.muted).text("No catch records available for this period.");
    } else {
      const tableTop = doc.y;
      doc.roundedRect(44, tableTop, contentWidth, 29, 5).fill(colors.navy);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.white)
        .text("FISH CATEGORY", 57, tableTop + 10)
        .text("QUANTITY", 280, tableTop + 10, { width: 75, align: "right" })
        .text("REVENUE", 420, tableTop + 10, { width: 95, align: "right" });
      doc.y = tableTop + 38;
      fishItems.slice(0, 4).forEach(([name, data], index) => {
        const y = doc.y;
        if (index % 2 === 0) doc.rect(44, y - 5, contentWidth, 29).fill("#F5F8FA");
        doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(name, 57, y + 3, { width: 190 });
        doc.font("Helvetica").text(`${data.quantity} ${data.unit || "kg"}`, 280, y + 3, { width: 75, align: "right" });
        doc.font("Helvetica-Bold").fillColor(colors.blue).text(money(data.income), 420, y + 3, { width: 95, align: "right" });
        doc.y = y + 29;
      });
      if (fishItems.length > 4) {
        doc.font("Helvetica-Oblique").fontSize(8).fillColor(colors.muted)
          .text(`Showing top 4 of ${fishItems.length} fish categories.`, 57, doc.y + 2);
        doc.y += 18;
      }
    }

    doc.moveDown(0.5);
    sectionTitle("Recommendations", "Practical observations based on this month's records.");
    if (recommendations.length === 0) {
      doc.font("Helvetica").fontSize(9).fillColor(colors.muted).text("No additional recommendations for this period.");
      doc.moveDown(0.8);
    } else {
      recommendations.slice(0, 1).forEach((rec) => {
        const accent = rec.type === "warning" ? colors.red : rec.type === "success" ? colors.green : colors.blue;
        const fill = rec.type === "warning" ? colors.paleRed : rec.type === "success" ? colors.paleGreen : colors.paleBlue;
        const y = doc.y;
        doc.roundedRect(44, y, contentWidth, 46, 6).fillAndStroke(fill, colors.line);
        doc.rect(44, y, 4, 46).fill(accent);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(accent).text(rec.title, 58, y + 9);
        doc.font("Helvetica").fontSize(8).fillColor(colors.ink).text(rec.message, 58, y + 24, { width: contentWidth - 72, height: 16, ellipsis: true });
        doc.y = y + 55;
      });
      if (recommendations.length > 1) {
        doc.font("Helvetica-Oblique").fontSize(8).fillColor(colors.muted).text(`Showing 2 of ${recommendations.length} recommendations.`);
      }
    }

    doc.moveDown(0.3);
    if (entries.length > 0) {
      sectionTitle("Daily Performance", "Income, expenses and profit recorded for each working day.");
      const tableTop = doc.y;
      doc.roundedRect(44, tableTop, contentWidth, 29, 5).fill(colors.navy);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(colors.white)
        .text("DATE", 57, tableTop + 10)
        .text("INCOME", 190, tableTop + 10, { width: 90, align: "right" })
        .text("EXPENSES", 300, tableTop + 10, { width: 90, align: "right" })
        .text("NET PROFIT", 420, tableTop + 10, { width: 95, align: "right" });
      doc.y = tableTop + 38;
      const visibleEntries = entries.slice(0, 5);
      visibleEntries.forEach((entry, index) => {
        const y = doc.y;
        if (index % 2 === 0) doc.rect(44, y - 5, contentWidth, 25).fill("#F5F8FA");
        doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink)
          .text(new Date(entry.date).toLocaleDateString(), 57, y + 3)
          .text(money(entry.totalIncome), 190, y + 3, { width: 90, align: "right" })
          .text(money(entry.totalExpenses), 300, y + 3, { width: 90, align: "right" });
        doc.font("Helvetica-Bold").fillColor(entry.netProfit >= 0 ? colors.green : colors.red)
          .text(money(entry.netProfit), 420, y + 3, { width: 95, align: "right" });
        doc.y = y + 25;
      });
      if (entries.length > visibleEntries.length) {
        doc.font("Helvetica-Oblique").fontSize(8).fillColor(colors.muted)
          .text(`Showing 5 of ${entries.length} daily entries in this two-page report.`);
      }
    }

    drawFooter();

    doc.end();
  });
}