interface TokenPayload {

  sub?: string;

  username?: string;

  nombre?: string;

  roles?: string[];

  exp?: number;

  iat?: number;

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


