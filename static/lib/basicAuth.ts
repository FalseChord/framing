// Checks an HTTP Basic `Authorization` header against the one shared site
// password. The username part is ignored — staff only need the password.
// Lives outside functions/ because every file there becomes a Pages route.
export function isAuthorized(authorizationHeader: string | null, expectedPassword: string): boolean {
  if (!expectedPassword || !authorizationHeader?.startsWith("Basic ")) {
    return false;
  }

  let credentials: string;
  try {
    const binary = atob(authorizationHeader.slice("Basic ".length));
    credentials = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }

  const password = credentials.slice(credentials.indexOf(":") + 1);
  return constantTimeEqual(password, expectedPassword);
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
