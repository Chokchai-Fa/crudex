const defaultSession = Symbol('default session');
const failures = new Map<string | symbol, number>();

export function checkFailureCount(sessionID: string | undefined) {
  return failures.get(sessionID ?? defaultSession) ?? 0;
}

export function resetCheckFailures(sessionID: string | undefined) {
  failures.delete(sessionID ?? defaultSession);
}

export function recordCheckResult(sessionID: string | undefined, ok: boolean) {
  if (ok === false) {
    failures.set(sessionID ?? defaultSession, checkFailureCount(sessionID) + 1);
  } else {
    resetCheckFailures(sessionID);
  }
}

export function resetCheckFailuresForTests() {
  failures.clear();
}
