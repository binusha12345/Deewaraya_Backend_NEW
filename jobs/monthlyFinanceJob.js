const cron = require("node-cron");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const { sumForRange } = require("../controllers/financeController");

// Emails every "owner" user their Income/Outcome/Net Profit for one given month
const sendMonthlyReportsFor = async (month, year) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const monthLabel = start.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const owners = await User.find({ role: "owner" }).select("name email");
  console.log(`📊 Sending ${monthLabel} finance reports to ${owners.length} owner(s)...`);

  for (const owner of owners) {
    try {
      const totals = await sumForRange(owner._id, start, end);

      await sendEmail({
        toEmail: owner.email,
        subject: `📊 Your ${monthLabel} Financial Summary — Deewaraya`,
        htmlContent: `
          <p>Hello ${owner.name || ""},</p>
          <p>Here is your automatic financial summary for <strong>${monthLabel}</strong>:</p>
          <ul>
            <li>Total Income: <strong>Rs. ${totals.income.toLocaleString()}</strong></li>
            <li>Total Outcome (Expenses): <strong>Rs. ${totals.expense.toLocaleString()}</strong></li>
            <li>Net Profit: <strong>Rs. ${totals.netProfit.toLocaleString()}</strong></li>
          </ul>
          <p>Log in to Deewaraya and open the Finance page to see full details and charts.</p>
        `,
      });

      console.log(`✅ Report emailed to ${owner.email}`);
    } catch (err) {
      console.error(`⚠️ Failed to email ${owner.email}:`, err.message);
    }
  }
};

// Runs at 07:00 on the 1st day of EVERY month, and reports on the month
// that just ended (the "previous" month relative to today)
const scheduleMonthlyFinanceEmails = () => {
  cron.schedule("0 7 1 * *", async () => {
    console.log("⏰ Monthly finance email job triggered...");
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    await sendMonthlyReportsFor(
      prevMonthDate.getMonth() + 1,
      prevMonthDate.getFullYear()
    );
  });

  console.log("🗓️  Monthly finance email job scheduled (1st of every month, 07:00).");
};

module.exports = { scheduleMonthlyFinanceEmails, sendMonthlyReportsFor };