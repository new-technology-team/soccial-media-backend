const bcrypt = require("bcryptjs");

const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, 10);

const comparePassword = (plainPassword, hash) => bcrypt.compare(plainPassword, hash);

module.exports = {
  hashPassword,
  comparePassword
};
