const env = require("../config/env");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");

const maskEmail = (email) => {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || "*"}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone) => {
  const value = String(phone || "");
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const sendOtpByEmail = async ({ email, code, purpose }) => {
  if (!env.otp.smtpHost || !env.otp.smtpUser || !env.otp.smtpPass) {
    return { sent: false, channel: "email", reason: "missing-smtp-config" };
  }

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (_error) {
    return { sent: false, channel: "email", reason: "nodemailer-not-installed" };
  }

  const smtpHost = String(env.otp.smtpHost || "").trim();
  const smtpUser = String(env.otp.smtpUser || "").trim();
  const smtpPass = String(env.otp.smtpPass || "").replace(/\s+/g, "").trim();

  const transportOptions = smtpHost.includes("gmail")
    ? {
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      }
    : {
        host: smtpHost,
        port: env.otp.smtpPort,
        secure: env.otp.smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      };

  const transporter = nodemailer.createTransport(transportOptions);

  const fromAddress = env.otp.smtpFrom || smtpUser;
  const subject = purpose === "reset" ? "Ma dat lai mat khau" : "Ma xac thuc tai khoan";
  const text = `Ma OTP cua ban la: ${code}. Ma co hieu luc trong 10 phut.`;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject,
      text
    });

    return { sent: true, channel: "email", destination: maskEmail(email) };
  } catch (error) {
    return {
      sent: false,
      channel: "email",
      reason: "smtp-send-failed",
      error: error.message
    };
  }
};

const sendOtpBySms = async ({ phone, code, purpose }) => {
  if (!env.otp.twilioSid || !env.otp.twilioToken || !env.otp.twilioFrom) {
    return { sent: false, channel: "sms", reason: "missing-twilio-config" };
  }

  let twilio;
  try {
    twilio = require("twilio");
  } catch (_error) {
    return { sent: false, channel: "sms", reason: "twilio-not-installed" };
  }

  const fromNumber = String(env.otp.twilioFrom || "").replace(/\s+/g, "");
  const toNumber = String(phone || "").replace(/\s+/g, "");
  const client = twilio(env.otp.twilioSid, env.otp.twilioToken);
  const body =
    purpose === "reset"
      ? `Ma dat lai mat khau cua ban la ${code}. Het han sau 10 phut.`
      : `Ma xac thuc tai khoan cua ban la ${code}. Het han sau 10 phut.`;

  try {
    await client.messages.create({
      body,
      from: fromNumber,
      to: toNumber
    });

    return { sent: true, channel: "sms", destination: maskPhone(phone) };
  } catch (error) {
    return {
      sent: false,
      channel: "sms",
      reason: "sms-send-failed",
      error: error.message
    };
  }
};

const sendOtp = async ({ identifier, code, purpose = "verify" }) => {
  const value = String(identifier || "").trim();
  if (!value) {
    return { sent: false, channel: "debug", reason: "missing-identifier" };
  }

  if (isEmail(value)) {
    return sendOtpByEmail({ email: value, code, purpose });
  }

  return sendOtpBySms({ phone: value, code, purpose });
};

module.exports = {
  sendOtp
};
