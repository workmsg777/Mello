interface ApiUrlOptions {
  configuredUrl?: string;
  platform: string;
  isDevelopment: boolean;
  expoHostUri?: string | null;
  browserHostname?: string;
}

const fallbackUrl = "http://localhost:4000/api";
const isLoopback = (host: string) =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host === "0.0.0.0" ||
  host === "[::1]" ||
  /^127\./.test(host);

function developmentHost(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;
  try {
    const host = new URL(
      hostUri.includes("://") ? hostUri : `http://${hostUri}`,
    ).hostname;
    // Metro tunnels do not also tunnel the API. Infer only a local-network host.
    if (
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
      host.endsWith(".local") ||
      /^\[(f[cd][0-9a-f]{2}:|fe80:)/i.test(host)
    )
      return host;
  } catch {
    /* Explicit API configuration remains available when Metro has no usable host. */
  }
  return null;
}

/** Keep production URLs explicit; physical phones can reuse Metro's LAN host in development. */
export function resolveApiBaseUrl(options: ApiUrlOptions): string {
  const configured = options.configuredUrl?.trim().replace(/\/+$/, "");
  if (!options.isDevelopment) return configured || fallbackUrl;
  if (options.platform === "web") {
    return (
      configured ||
      (options.browserHostname
        ? `http://${options.browserHostname}:4000/api`
        : fallbackUrl)
    );
  }
  const host = developmentHost(options.expoHostUri);
  if (!host) return configured || fallbackUrl;
  if (!configured) return `http://${host}:4000/api`;
  try {
    const url = new URL(configured);
    if (isLoopback(url.hostname)) {
      url.hostname = host;
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    /* Return the original configuration so the normal request error explains it. */
  }
  return configured;
}
