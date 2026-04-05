const { S3Client } = require("@aws-sdk/client-s3");
const env = require("./env");

const hasAwsConfig =
  Boolean(env.aws.region) &&
  Boolean(env.aws.bucket) &&
  Boolean(env.aws.accessKeyId) &&
  Boolean(env.aws.secretAccessKey);

const s3Client = hasAwsConfig
  ? new S3Client({
      region: env.aws.region,
      credentials: {
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey
      }
    })
  : null;

module.exports = { s3Client, hasAwsConfig };
