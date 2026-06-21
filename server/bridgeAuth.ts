const encoder = new TextEncoder();

export async function secureTokenEqual(
  candidate: string,
  expected: string
): Promise<boolean> {
  if (!candidate || !expected) return false;
  const [candidateDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);

  const left = new Uint8Array(candidateDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

export async function authorizeBridgeToken(
  expected: string,
  authorizationHeader?: string,
  alternateHeader?: string
): Promise<boolean> {
  if (!expected) return false;
  const authorization = String(authorizationHeader || "");
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const alternate = String(alternateHeader || "").trim();
  const [bearerMatch, alternateMatch] = await Promise.all([
    secureTokenEqual(bearer, expected),
    secureTokenEqual(alternate, expected),
  ]);
  return bearerMatch || alternateMatch;
}
