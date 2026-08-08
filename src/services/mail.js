const nodemailer = require("nodemailer");
const crypto = require("crypto");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

function generateSecureCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendVerificationEmail(email, code, role) {
  await transporter.sendMail({
    from: `"amjadMagicCenter" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Password Reset Verification Code",
    text: `Your verification code is ${code}. It expires in 5 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>${role.toUpperCase()} Password Reset</h2>
        <p>Your verification code is:</p>

        <div style="
          font-size:30px;
          font-weight:bold;
          letter-spacing:8px;
          color:#b8860b;
          margin:20px 0;
        ">
          ${code}
        </div>

        <p>This code expires in <b>2 minutes</b>.</p>

        <p>If you didn't request this, simply ignore this email.</p>
      </div>
    `,
  });
}

module.exports = {
  generateSecureCode,
  sendVerificationEmail,
};