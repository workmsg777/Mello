// Preserve app.json, including the distinct EAS project ID added by `eas init`.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD === "true") {
    let url;
    try {
      url = new URL(process.env.EXPO_PUBLIC_API_URL);
    } catch {
      /* Explained below. */
    }
    if (
      !url ||
      url.protocol !== "https:" ||
      !url.pathname.replace(/\/+$/, "").endsWith("/api") ||
      ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname)
    ) {
      throw new Error(
        "Set EXPO_PUBLIC_API_URL to your reachable HTTPS backend URL ending in /api in this EAS project's preview or production environment before building. Standalone APKs cannot use localhost or Expo Go LAN auto-detection.",
      );
    }
  }
  if (process.env.GOOGLE_SERVICES_FILE) {
    config.android = {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_FILE,
    };
  }
  return config;
};
