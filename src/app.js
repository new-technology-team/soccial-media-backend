const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const socialRoutes = require("./routes/social.routes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: "15mb" }));
app.use(morgan("dev"));

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "backend", now: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/social", socialRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: "Internal server error", error: err.message });
});

module.exports = app;
