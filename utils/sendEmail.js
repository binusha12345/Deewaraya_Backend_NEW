// server/utils/sendEmail.js
const nodemailer = require("nodemailer");

const sendEmail = async ({ toEmail, subject, htmlContent, attachments = [] }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
      attachments: attachments, // ✅ Support attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to:", toEmail);
    console.log("📧 Message ID:", info.messageId);
    return info;

  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    throw new Error("Email could not be sent: " + error.message);
  }
};

module.exports = sendEmail;