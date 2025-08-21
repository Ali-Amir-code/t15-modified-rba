import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

let transporter = null;

// Initialize transporter with SMTP settings


// Function to send email
export async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    console.error("Error: Transporter is not initialized.");
    return;
  }

  try {
    // Debugging test: Verify email settings
    console.log("Email settings:");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Text:", text);
    console.log("HTML:", html);

    // Send email using transporter
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html
    };

    // Debugging test: Verify mail options
    console.log("Mail options:");
    console.log(mailOptions);

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);

  } catch (err) {
    console.error("Error sending email:", err);
  }
}