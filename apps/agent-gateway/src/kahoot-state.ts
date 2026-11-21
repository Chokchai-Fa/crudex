import { z } from 'zod';

const schoolPrefix = 'school:';
const schoolName = z.templateLiteral([schoolPrefix, z.uuid(), '/', z.uuid()]);

export function kahootInstanceName(owner?: string) {
  return owner === undefined ? 'kahoot' : schoolPrefix + owner;
}

function encodeName(name: string) {
  return btoa(name).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function kahootState(name: string, nonce: string) {
  return encodeName(name) + '.' + nonce;
}

export function parseKahootState(state: string | null) {
  const [, encoded, nonce] = /^([A-Za-z0-9_-]{1,128})\.([0-9a-f]{64})$/.exec(state ?? '') ?? [];
  if (!encoded || !nonce) return;
  let name: string;
  try {
    name = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
  } catch {
    return;
  }
  if (encodeName(name) !== encoded) return;
  if (name === kahootInstanceName()) return { kind: 'demo' as const, name, nonce };
  if (schoolName.safeParse(name).success) return { kind: 'school' as const, name, nonce };
}
