interface TokenPayload {
  sub?: string;
  username?: string;
  roles?: string[];
}

export function decodeAccessToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}
