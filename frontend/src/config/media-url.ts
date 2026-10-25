/** Resolve stored media against the API host, including old local development URLs. */
export function resolveMediaUrl(
  value: string | null | undefined,
  apiBaseUrl: string,
  development = false,
): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  if (/^(data:|blob:|file:|content:)/i.test(url)) return url;
  try {
    const origin = new URL(apiBaseUrl).origin;
    if (/^https?:\/\//i.test(url)) {
      const absolute = new URL(url);
      const loopback =
        absolute.hostname === "localhost" ||
        absolute.hostname === "[::1]" ||
        absolute.hostname === "0.0.0.0" ||
        /^127\./.test(absolute.hostname);
      if (development && loopback && absolute.pathname.startsWith("/uploads/"))
        return new URL(absolute.pathname + absolute.search, origin).toString();
      return absolute.toString();
    }
    const path = url.startsWith("profile-photos/")
      ? `/uploads/${url}`
      : `/${url.replace(/^\/+/, "")}`;
    return new URL(path, origin).toString();
  } catch {
    return undefined;
  }
}
