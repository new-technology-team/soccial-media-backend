const http = require("http");
const app = require("./app");
const env = require("./config/env");
const initializeSocket = require("./socket");
const { ensureUserSchema } = require("./models/user.model");
const { ensureChatSchema } = require("./models/chat.model");
const { ensureSocialSchema } = require("./models/social.model");

const server = http.createServer(app);
initializeSocket(server, env.corsOrigins);

const startServer = async () => {
  try {
    await ensureUserSchema();
    await ensureChatSchema();
    await ensureSocialSchema();

    server.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Cannot start backend:", error.message);
    process.exit(1);
  }
};

startServer();
