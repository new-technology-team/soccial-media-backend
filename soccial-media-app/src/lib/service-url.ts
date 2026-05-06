const IPV4_WITH_MISSING_PORT_SEPARATOR =
  /^(https?:\/\/\d{1,3}(?:\.\d{1,3}){3})(\d{2,5})(\/|$)/i;

function ensureProtocol(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return url;
  }

  return `http://${url}`;
}

export function normalizeServiceUrl(
  rawValue: string | undefined,
  fallback: string,
): string {
  const fallbackUrl = fallback.replace(/\/+$/, "");
  const trimmedValue = String(rawValue || "").trim();

  if (!trimmedValue) {
    return fallbackUrl;
  }

  let normalized = trimmedValue.replace(/["']/g, "");
  normalized = ensureProtocol(normalized);
  normalized = normalized.replace(IPV4_WITH_MISSING_PORT_SEPARATOR, "$1:$2$3");
  normalized = normalized.replace(/\/+$/, "");

  try {
    const parsed = new URL(normalized);

    // Android emulator maps 10.0.2.2 to host localhost, usually served over HTTP.
    if (parsed.hostname === "10.0.2.2" && parsed.protocol === "https:") {
      parsed.protocol = "http:";
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return fallbackUrl;
  }
}
