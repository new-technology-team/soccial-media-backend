const mariadb = require("mariadb");
const env = require("./env");

const pool = mariadb.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  connectionLimit: 5
});

module.exports = pool;
