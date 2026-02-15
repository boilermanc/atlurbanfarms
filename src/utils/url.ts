/**
 * Validates a URL string and returns it only if it uses a safe protocol (http/https).
 * Prevents javascript: protocol injection via stored URLs.
 */
/**
 * Safely decodes a URI component, returning the original string if decoding fails
 * (e.g., malformed percent-encoding like %E0%A4%A).
 */
export const safeDecodeURIComponent = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export const getSafeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) {
      return url;
    }
    return '#';
  } catch {
    return '#';
  }
};
