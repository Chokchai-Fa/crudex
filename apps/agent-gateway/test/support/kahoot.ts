import { KahootConnection } from '../../src/kahoot-connection';

export function kahootConnection(name = 'kahoot') {
  const values = new Map<string, unknown>();
  return new KahootConnection(
    {
      id: { name },
      storage: {
        get: async (key: string) => structuredClone(values.get(key)),
        put: async (key: string, value: unknown) => values.set(key, structuredClone(value)),
        delete: async (key: string) => values.delete(key),
      },
    } as unknown as DurableObjectState,
    {} as Env,
  );
}
