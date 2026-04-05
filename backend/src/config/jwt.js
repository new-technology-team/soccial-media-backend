const jwt = require("jsonwebtoken");
const env = require("./env");

const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
