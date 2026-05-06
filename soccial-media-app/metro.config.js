const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const result = withNativewind(config, {
  // globalClassNamePolyfill: false — the app uses className directly, no styled() components
});

module.exports = result;
