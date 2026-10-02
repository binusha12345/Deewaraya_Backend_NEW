const DailyFinance = require("../models/Finance");
const PDFDocument = require("pdfkit");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail"); // ✅ Brevo utility
// ✅ WhatsApp - whatsapp-web.js version
const {
  sendWhatsAppPDF,
  sendWhatsAppText,
  getWhatsAppStatus,
} = require("../services/whatsappService");

const normalizeWhatsappNumber = (value) =>
  String(value || "").replace(/[\s\-()]/g, "");

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

// ==================== PDF WHATSAPP SENDING ====================

exports.sendMonthlyReportWhatsApp = async (req, res) => {
  try {
    console.log("📱 STEP 1: Starting sendMonthlyReportWhatsApp");
    const { year, month, whatsappNumber } = req.body;
    const normalizedNumber = normalizeWhatsappNumber(whatsappNumber);

    // --- Validate WhatsApp number ---
    if (!normalizedNumber) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp number is required",
      });
    }

    // +94771234567 හෝ 0771234567 දෙකම accept කරනවා
    const phoneRegex = /^(\+?[1-9]\d{7,14}|0\d{9})$/;
    if (!phoneRegex.test(normalizedNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number. Use +94771234567 or 0771234567 format.",
      });
    }

    // --- Check WhatsApp Client Status Safely ---
    let isConnected = false;
    try {
      if (typeof getWhatsAppStatus === "function") {
        const status = getWhatsAppStatus();
        isConnected = !!(status && status.connected);
      }
    } catch (stErr) {
      console.warn("⚠️ WhatsApp Status Check warning:", stErr.message);
      isConnected = false;
    }

    if (!isConnected) {
      return res.status(503).json({
        success: false,
        message:
          "WhatsApp Client is not connected. Please scan the QR code from the server terminal.",
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

    if (!entries || entries.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found for this month",
      });
    }

    // --- Calculate summary ---
    const summary = entries.reduce(
      (acc, entry) => {
        acc.totalIncome += entry.totalIncome || 0;
        acc.totalExpenses += entry.totalExpenses || 0;
        acc.totalNetProfit += entry.netProfit || 0;
        acc.workingDays += 1;

        if (entry.expenses && Array.isArray(entry.expenses)) {
          entry.expenses.forEach((exp) => {
            acc.expenseBreakdown[exp.category] =
              (acc.expenseBreakdown[exp.category] || 0) + (exp.amount || 0);
          });
        }

        if (entry.fishEntries && Array.isArray(entry.fishEntries)) {
          entry.fishEntries.forEach((fish) => {
            if (!acc.fishBreakdown[fish.fishName]) {
              acc.fishBreakdown[fish.fishName] = { quantity: 0, income: 0 };
            }
            acc.fishBreakdown[fish.fishName].quantity += fish.quantity || 0;
            acc.fishBreakdown[fish.fishName].income += fish.totalPrice || 0;
          });
        }

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

    // --- Generate PDF ---
    const pdfBuffer = await generatePDF(
      summary,
      recommendations,
      monthName,
      year,
      entries,
      user.name || "Boat Owner"
    );

    console.log("📱 STEP 3: PDF generated, size:", pdfBuffer.length, "bytes");

    // --- Compose WhatsApp caption ---
    const profitEmoji = summary.totalNetProfit >= 0 ? "📈" : "📉";
    const profitMargin =
      summary.totalIncome > 0
        ? ((summary.totalNetProfit / summary.totalIncome) * 100).toFixed(1)
        : 0;

    const caption =
      `*Deewaraya - Monthly Finance Report*\n\n` +
      `📅 Period: ${monthName} ${year}\n` +
      `💰 Total Income: Rs. ${summary.totalIncome.toLocaleString()}\n` +
      `💸 Total Expenses: Rs. ${summary.totalExpenses.toLocaleString()}\n` +
      `${profitEmoji} Net Profit: Rs. ${summary.totalNetProfit.toLocaleString()}\n` +
      `🚤 Working Days: ${summary.workingDays}\n` +
      `📊 Profit Margin: ${profitMargin}%\n\n` +
      `The detailed PDF report is attached below.`;

    // --- Send via whatsapp-web.js ---
    console.log("📱 STEP 4: Sending WhatsApp to:", normalizedNumber);
    const fileName = `Deewaraya_Report_${monthName}_${year}.pdf`;

    await sendWhatsAppPDF(normalizedNumber, pdfBuffer, caption, fileName);

    console.log("✅ STEP 5: WhatsApp sent successfully!");

    return res.status(200).json({
      success: true,
      message: `Monthly report sent to ${normalizedNumber} successfully!`,
    });
  } catch (error) {
    console.error("❌ Send WhatsApp error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send WhatsApp report",
    });
  }
};

// ==================== WHATSAPP STATUS ====================

exports.getWhatsAppConnectionStatus = async (req, res) => {
  try {
    const status = getWhatsAppStatus();
    res.json({
      success: true,
      data: {
        connected: status.connected,
        phoneNumber: status.phoneNumber,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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

// PDF Generator - Clean Professional 3-Page Report (No glitch / No empty pages)
async function generatePDF(
  summary,
  recommendations,
  monthName,
  year,
  entries,
  ownerName
) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
      autoFirstPage: true,
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // ========== LAYOUT ==========
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const L = 50;                 // left
    const R = pageW - 50;         // right
    const W = R - L;              // content width
    const CX = pageW / 2;         // center

    // ========== COLORS ==========
    const C = {
      navy: "#123B3D",
      blue: "#0B6E6B",
      sky: "#6FAEAA",
      teal: "#167F79",
      green: "#167F79",
      red: "#DC2626",
      orange: "#167F79",
      ink: "#203536",
      muted: "#617675",
      light: "#77908F",
      line: "#C8D8D6",
      bg: "#EEF5F4",
      white: "#FFFFFF",
      pBlue: "#E7F1F0",
      pGreen: "#E7F1F0",
      pRed: "#FEF2F2",
      pTeal: "#E7F1F0",
      pOrange: "#E7F1F0",
    };

    // ========== HELPERS ==========
    const money = (v) => `Rs. ${Math.round(Number(v) || 0).toLocaleString("en-LK")}`;
    const pct = (v, t) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : "0%");
    const safe = (v, d = 0) => (v === undefined || v === null || isNaN(v) ? d : v);

    const totalIncome = safe(summary.totalIncome);
    const totalExpenses = safe(summary.totalExpenses);
    const totalNetProfit = safe(summary.totalNetProfit);
    const workingDays = safe(summary.workingDays, 0);
    const profitMargin = totalIncome > 0 ? (totalNetProfit / totalIncome) * 100 : 0;
    const profitColor = totalNetProfit >= 0 ? C.green : C.red;

    const categoryLabels = {
      fuel: "Fuel",
      driver_salary: "Driver Salary",
      ice: "Ice",
      repair_maintenance: "Repair & Maintenance",
      equipment: "Equipment",
      other: "Other",
    };

    // Keep the report within its three planned pages.
    const ensureSpace = (need = 60) => {
      return doc.y <= pageH - 55 - need;
    };

    // Solid sea-green page header, repeated consistently across the report.
    const drawTopBar = () => {
      doc.rect(0, 0, pageW, 66).fill(C.navy);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.white)
        .text("DEEWARAYA", L, 13, { characterSpacing: 1 });
      doc.font("Helvetica-Bold").fontSize(15).fillColor(C.white)
        .text("MONTHLY FINANCE REPORT", L, 31);
      doc.font("Helvetica").fontSize(8).fillColor("#D4E7E4")
        .text(`${monthName} ${year}`, L, 49);
      doc.font("Helvetica").fontSize(8).fillColor("#D4E7E4")
        .text(new Date().toLocaleDateString("en-GB"), L, 19, {
          width: W,
          align: "right",
        });
      doc.y = 82;
    };

    // Centered section title with underline
    const sectionTitle = (title) => {
      ensureSpace(40);
      doc.moveDown(0.35);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(C.navy)
        .text(String(title).toUpperCase(), L, doc.y, {
          width: W,
          align: "center",
          characterSpacing: 0.8,
        });
      const tw = Math.min(doc.widthOfString(String(title).toUpperCase()) + 16, W);
      const x0 = CX - tw / 2;
      doc.moveTo(x0, doc.y + 3).lineTo(x0 + tw, doc.y + 3)
        .strokeColor(C.blue).lineWidth(1.4).stroke();
      doc.moveDown(0.85);
    };

    // Footer for current page number (drawn at end on all pages)
    const drawFooterOnPage = (pageIndex1Based) => {
      doc.moveTo(L, pageH - 82).lineTo(R, pageH - 82)
        .strokeColor(C.line).lineWidth(0.7).stroke();
      doc.font("Helvetica").fontSize(7).fillColor(C.light)
        .text("Deewaraya Finance  |  Confidential Owner Report", L, pageH - 72, {
          width: W - 50,
          lineBreak: false,
        });
      doc.font("Helvetica").fontSize(7).fillColor(C.light)
        .text(`Page ${pageIndex1Based}`, L, pageH - 72, {
          width: W,
          align: "right",
          lineBreak: false,
        });
    };

    // Compact text row for category breakdowns.
    const drawBarRow = (label, sub, amount, total) => {
      ensureSpace(28);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(C.ink)
        .text(label, L, y, { width: 190, ellipsis: true });
      if (sub) {
        doc.font("Helvetica").fontSize(8).fillColor(C.muted)
          .text(sub, L + 200, y, { width: 110, ellipsis: true });
      }
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink)
        .text(money(amount), R - 112, y, { width: 112, align: "right" });
      doc.font("Helvetica").fontSize(7.5).fillColor(C.muted)
        .text(pct(amount, total), R - 112, y + 11, { width: 112, align: "right" });
      doc.moveTo(L, y + 20).lineTo(R, y + 20).strokeColor(C.line).lineWidth(0.45).stroke();
      doc.y = y + (sub ? 27 : 24);
    };

    // ========== PAGE 1 ==========
    drawTopBar();

    doc.font("Helvetica").fontSize(9).fillColor(C.muted)
      .text(`Prepared for ${ownerName || "Boat Owner"}`, L, doc.y, { width: W });
    doc.moveDown(0.9);

    // 4 metric cards
    {
      const gap = 12;
      const cardW = (W - gap * 3) / 4;
      const y0 = doc.y;
      const cards = [
        { t: "TOTAL INCOME", v: money(totalIncome), a: C.blue, bg: C.pBlue },
        { t: "TOTAL EXPENSES", v: money(totalExpenses), a: C.red, bg: C.pRed },
        {
          t: "NET PROFIT",
          v: money(totalNetProfit),
          a: profitColor,
          bg: totalNetProfit >= 0 ? C.pGreen : C.pRed,
        },
        {
          t: "PROFIT MARGIN",
          v: `${profitMargin.toFixed(1)}%`,
          a: C.teal,
          bg: C.pTeal,
        },
      ];

      cards.forEach((c, i) => {
        const x = L + i * (cardW + gap);
        if (i > 0) doc.moveTo(x - gap / 2, y0).lineTo(x - gap / 2, y0 + 53).strokeColor(C.line).lineWidth(0.7).stroke();
        doc.font("Helvetica").fontSize(7).fillColor(C.muted)
          .text(c.t, x, y0 + 4, { width: cardW, align: "center" });
        doc.font("Helvetica-Bold").fontSize(10).fillColor(c.a)
          .text(c.v, x, y0 + 24, { width: cardW, align: "center", ellipsis: true });
      });
      doc.moveTo(L, y0 + 56).lineTo(R, y0 + 56).strokeColor(C.line).lineWidth(0.7).stroke();
      doc.y = y0 + 70;
    }

    // Operating snapshot strip
    {
      const y0 = doc.y;
      const h = 34;
      const col = W / 3;
      const avgIn = money(totalIncome / (workingDays || 1));
      const avgEx = money(totalExpenses / (workingDays || 1));

      const colItem = (title, val, ox) => {
        doc.font("Helvetica").fontSize(7).fillColor(C.muted)
          .text(title, L + ox, y0 + 3, { width: col, align: "center" });
        doc.font("Helvetica-Bold").fontSize(9).fillColor(C.ink)
          .text(val, L + ox, y0 + 16, { width: col, align: "center" });
      };
      doc.moveTo(L, y0).lineTo(R, y0).strokeColor(C.line).lineWidth(0.7).stroke();
      colItem("WORKING DAYS", String(workingDays), 0);
      colItem("AVG DAILY INCOME", avgIn, col);
      colItem("AVG DAILY EXPENSE", avgEx, col * 2);
      doc.moveTo(L, y0 + h).lineTo(R, y0 + h).strokeColor(C.line).lineWidth(0.7).stroke();
      doc.y = y0 + h + 18;
    }

    // Expense breakdown
    sectionTitle("Expense Breakdown");
    {
      const items = Object.entries(summary.expenseBreakdown || {})
        .map(([k, v]) => [categoryLabels[k] || k, safe(v)])
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

      if (items.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(C.muted)
          .text("No expenses recorded for this month.", L, doc.y, {
            width: W,
            align: "center",
          });
        doc.moveDown(1);
      } else {
        items.slice(0, 6).forEach(([label, amount]) => {
          drawBarRow(label, null, amount, totalExpenses);
        });
        if (items.length > 6) {
          doc.font("Helvetica-Oblique").fontSize(8).fillColor(C.muted)
            .text(`Showing 6 of ${items.length} expense categories.`, L, doc.y);
        }
        doc.moveDown(0.4);
      }
    }

    sectionTitle("Weekly Cash Flow");
    {
      const referenceDate = entries?.length ? new Date(entries[0].date) : new Date(year, 0, 1);
      const daysInMonth = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth() + 1,
        0
      ).getDate();
      const weeks = Array.from({ length: 5 }, (_, index) => ({
        label: `Days ${String(index * 7 + 1).padStart(2, "0")}-${String(Math.min((index + 1) * 7, daysInMonth)).padStart(2, "0")}`,
        days: 0,
        income: 0,
        expenses: 0,
        profit: 0,
      }));
      (entries || []).forEach((entry) => {
        const day = new Date(entry.date).getDate();
        const week = weeks[Math.min(Math.floor((day - 1) / 7), 4)];
        week.days += 1;
        week.income += safe(entry.totalIncome);
        week.expenses += safe(entry.totalExpenses);
        week.profit += safe(entry.netProfit, safe(entry.totalIncome) - safe(entry.totalExpenses));
      });

      const headerY = doc.y;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.muted)
        .text("PERIOD", L, headerY)
        .text("DAYS", L + 128, headerY, { width: 42, align: "right" })
        .text("INCOME", L + 185, headerY, { width: 95, align: "right" })
        .text("EXPENSES", L + 292, headerY, { width: 100, align: "right" })
        .text("PROFIT", R - 78, headerY, { width: 78, align: "right" });
      doc.moveTo(L, headerY + 14).lineTo(R, headerY + 14).strokeColor(C.blue).lineWidth(0.8).stroke();
      doc.y = headerY + 21;

      weeks.forEach((week) => {
        const y = doc.y;
        doc.font("Helvetica").fontSize(8.5).fillColor(C.ink)
          .text(week.label, L, y)
          .text(String(week.days), L + 128, y, { width: 42, align: "right" })
          .text(money(week.income), L + 185, y, { width: 95, align: "right" })
          .text(money(week.expenses), L + 292, y, { width: 100, align: "right" });
        doc.font("Helvetica-Bold").fontSize(8.5)
          .fillColor(week.profit >= 0 ? C.green : C.red)
          .text(money(week.profit), R - 78, y, { width: 78, align: "right" });
        doc.moveTo(L, y + 19).lineTo(R, y + 19).strokeColor(C.line).lineWidth(0.4).stroke();
        doc.y = y + 31;
      });

      const bestWeek = weeks.reduce(
        (best, week) => week.days && (!best || week.profit > best.profit) ? week : best,
        null
      );
      const highlights = [
        ["Highest weekly profit", bestWeek ? `${bestWeek.label}  |  ${money(bestWeek.profit)}` : "No weekly activity"],
        ["Expenses as share of income", pct(totalExpenses, totalIncome)],
        ["Average daily profit", money(totalNetProfit / (workingDays || 1))],
      ];
      sectionTitle("Period Highlights");
      highlights.forEach(([label, value]) => {
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink)
          .text(label, L, y, { width: 210 });
        doc.font("Helvetica").fontSize(8.5).fillColor(C.blue)
          .text(value, L + 215, y, { width: W - 215, align: "right", ellipsis: true });
        doc.moveTo(L, y + 17).lineTo(R, y + 17).strokeColor(C.line).lineWidth(0.4).stroke();
        doc.y = y + 23;
      });
    }

    // ========== PAGE 2 ==========
    doc.addPage();
    drawTopBar();

    // Income by catch
    sectionTitle("Income by Catch");
    {
      const items = Object.entries(summary.fishBreakdown || {})
        .map(([name, d]) => ({
          name,
          qty: safe(d?.quantity),
          unit: d?.unit || "kg",
          income: safe(d?.income),
        }))
        .filter((x) => x.income > 0 || x.qty > 0)
        .sort((a, b) => b.income - a.income);

      if (items.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(C.muted)
          .text("No catch records for this month.", L, doc.y, {
            width: W,
            align: "center",
          });
        doc.moveDown(1);
      } else {
        items.slice(0, 6).forEach((it) => {
          drawBarRow(
            it.name,
            `${it.qty} ${it.unit}`,
            it.income,
            totalIncome
          );
        });
        if (items.length > 6) {
          doc.font("Helvetica-Oblique").fontSize(8).fillColor(C.muted)
            .text(`Showing top 6 of ${items.length} fish categories.`, L, doc.y);
        }
        doc.moveDown(0.5);
      }
    }

    // Operational insights (always filled)
    sectionTitle("Operational Insights");
    {
      const fuel = safe(summary.expenseBreakdown?.fuel);
      const fuelPct = totalExpenses > 0 ? (fuel / totalExpenses) * 100 : 0;

      let best = null;
      let worst = null;
      (entries || []).forEach((e) => {
        const p = safe(e.netProfit);
        if (!best || p > safe(best.netProfit)) best = e;
        if (!worst || p < safe(worst.netProfit)) worst = e;
      });

      const bestText = best
        ? `${new Date(best.date).toLocaleDateString("en-GB")} | ${money(best.netProfit)}`
        : "Not enough daily data yet. Keep logging daily trips.";
      const worstText = worst
        ? `${new Date(worst.date).toLocaleDateString("en-GB")} | ${money(worst.netProfit)}`
        : "No weak day detected from current records.";
      const insights = [
        ["Fuel share of expenses", `${fuelPct.toFixed(1)}%  |  ${money(fuel)}`],
        ["Best profit day", bestText],
        ["Lowest profit day", worstText],
        ["Average daily net", money(totalNetProfit / (workingDays || 1))],
      ];
      insights.forEach(([label, value]) => {
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink)
          .text(label, L, y, { width: 190 });
        doc.font("Helvetica").fontSize(8.5).fillColor(C.muted)
          .text(value, L + 195, y, { width: W - 195, align: "right", ellipsis: true });
        doc.moveTo(L, y + 15).lineTo(R, y + 15).strokeColor(C.line).lineWidth(0.45).stroke();
        doc.y = y + 19;
      });
    }

    // Recommendations (always show something)
    sectionTitle("Recommendations");
    {
      const list =
        recommendations && recommendations.length
          ? recommendations.slice(0, 2)
          : [
              {
                type: "info",
                title: "Keep Daily Logging",
                message:
                  "Continue recording catch and expenses every trip for more accurate monthly decisions.",
              },
            ];

      list.forEach((rec) => {
        ensureSpace(56);
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.blue)
          .text(rec.title || "Note", L, y, { width: W });
        doc.font("Helvetica").fontSize(8).fillColor(C.ink)
          .text(rec.message || "", L, y + 13, {
            width: W,
            height: 22,
            ellipsis: true,
          });
        doc.moveTo(L, y + 39).lineTo(R, y + 39).strokeColor(C.line).lineWidth(0.45).stroke();
        doc.y = y + 45;
      });
    }

    sectionTitle("Expense Activity");
    {
      const activityCounts = {};
      (entries || []).forEach((entry) => {
        (entry.expenses || []).forEach((expense) => {
          activityCounts[expense.category] = (activityCounts[expense.category] || 0) + 1;
        });
      });
      const expenseItems = Object.entries(summary.expenseBreakdown || {})
        .map(([category, amount]) => ({
          category: categoryLabels[category] || category,
          count: activityCounts[category] || 0,
          amount: safe(amount),
        }))
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);

      const headerY = doc.y;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.muted)
        .text("EXPENSE CATEGORY", L, headerY)
        .text("ITEMS", L + 250, headerY, { width: 55, align: "right" })
        .text("MONTHLY TOTAL", R - 125, headerY, { width: 125, align: "right" });
      doc.moveTo(L, headerY + 14).lineTo(R, headerY + 14).strokeColor(C.blue).lineWidth(0.8).stroke();
      doc.y = headerY + 21;

      if (expenseItems.length === 0) {
        doc.font("Helvetica").fontSize(8.5).fillColor(C.muted)
          .text("No expense activity recorded for this month.", L, doc.y);
        doc.moveDown(1);
      } else {
        expenseItems.forEach((item) => {
          const y = doc.y;
          doc.font("Helvetica").fontSize(8.5).fillColor(C.ink)
            .text(item.category, L, y, { width: 230, ellipsis: true })
            .text(String(item.count), L + 250, y, { width: 55, align: "right" });
          doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.blue)
            .text(money(item.amount), R - 125, y, { width: 125, align: "right" });
          doc.moveTo(L, y + 19).lineTo(R, y + 19).strokeColor(C.line).lineWidth(0.4).stroke();
          doc.y = y + 25;
        });
      }
    }

    // ========== PAGE 3 ==========
    doc.addPage();
    drawTopBar();
    sectionTitle("Daily Expenses & Profit");

    {
      const rows = Array.isArray(entries)
        ? [...entries].sort((a, b) => new Date(a.date) - new Date(b.date))
        : [];

      if (rows.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(C.muted)
          .text("No daily entries for this month.", L, doc.y, {
            width: W,
            align: "center",
          });
      } else {
        // header strip
        ensureSpace(30);
        const hy = doc.y;
        doc.roundedRect(L, hy, W, 18, 4).fill(C.navy);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(C.white);
        doc.text("DATE", L + 10, hy + 5);
        doc.text("INCOME", L + 120, hy + 5, { width: 90, align: "right" });
        doc.text("DAILY EXPENSES", L + 230, hy + 5, { width: 90, align: "right" });
        doc.text("DAILY PROFIT", L + 340, hy + 5, { width: W - 350, align: "right" });
        doc.y = hy + 24;

        rows.slice(0, 31).forEach((e, idx) => {
          ensureSpace(24);
          const y = doc.y;
          const d = new Date(e.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const inc = safe(e.totalIncome);
          const exp = safe(e.totalExpenses);
          const net = safe(e.netProfit, inc - exp);

          doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink)
            .text(d, L + 10, y);
          doc.font("Helvetica").fontSize(8.5).fillColor(C.blue)
            .text(money(inc), L + 120, y, { width: 90, align: "right" });
          doc.font("Helvetica").fontSize(8.5).fillColor(C.red)
            .text(money(exp), L + 230, y, { width: 90, align: "right" });
          doc.font("Helvetica-Bold").fontSize(8.5)
            .fillColor(net >= 0 ? C.green : C.red)
            .text(money(net), L + 340, y, { width: W - 350, align: "right" });
          doc.moveTo(L, y + 15).lineTo(R, y + 15).strokeColor(C.line).lineWidth(0.35).stroke();
          doc.y = y + 17;
        });

        doc.moveDown(0.8);
        doc.font("Helvetica").fontSize(8).fillColor(C.muted)
          .text(
            rows.length > 31
              ? `Showing 31 of ${rows.length} daily records.`
              : `Total working days logged: ${rows.length}`,
            L,
            doc.y,
            {
            width: W,
            align: "right",
            }
          );
      }
    }

    // Final summary box (fills leftover space usefully)
    doc.moveDown(1);
    ensureSpace(70);
    {
      const y = doc.y;
      doc.moveTo(L, y).lineTo(R, y).strokeColor(C.blue).lineWidth(1).stroke();
      doc.font("Helvetica-Bold").fontSize(9).fillColor(C.blue)
        .text("MONTH CLOSE", L, y + 8);
      doc.font("Helvetica").fontSize(8).fillColor(C.ink)
        .text(
          `Income ${money(totalIncome)}   |   Expenses ${money(totalExpenses)}   |   Net ${money(totalNetProfit)}   |   Margin ${profitMargin.toFixed(1)}%`,
          L,
          y + 24,
          { width: W - 28 }
        );
      doc.y = y + 42;
    }

    // Draw footers on all pages
    const range = doc.bufferedPageRange(); // { start, count }
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooterOnPage(i + 1);
    }

    doc.end();
  });
}