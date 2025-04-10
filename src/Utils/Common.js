const nodemailer = require("nodemailer");

// utils/validation.js
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (email, otp) => {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "testingdvtesting@gmail.com",
        pass: "octt wtdo ymyg zgjy",
      },
    });

    let mailOptions = {
      from: "testingdvtesting@gmail.com",
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);
  } catch (e) {
    console.log(e);
  }
};

const sendResetEmail = async (email, resetLink) => {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "testingdvtesting@gmail.com",
        pass: "octt wtdo ymyg zgjy",
      },
    });

    let mailOptions = {
      from: "testingdvtesting@gmail.com",
      to: email,
      subject: "Reset Your Password",
      text: `Click the link below to reset your password. This link is valid for 15 minutes only:\n\n${resetLink}`,
    };

    await transporter.sendMail(mailOptions);
  } catch (e) {
    console.log(e);
  }
};

module.exports = { isValidEmail, generateOTP, sendOTP, sendResetEmail };
