import { vi } from 'vitest';

// ─── In-memory S3 store ───────────────────────────────────────────────────────

type StoredObject = {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
};

const objectStore = new Map<string, StoredObject>();

export function getStoredObjects(): Map<string, StoredObject> {
  return objectStore;
}

export function getStoredObject(key: string): StoredObject | undefined {
  return objectStore.get(key);
}

export function resetS3Mock() {
  objectStore.clear();
  vi.clearAllMocks();
}

// ─── Mock S3 client ───────────────────────────────────────────────────────────

export const mockS3Client = {
  send: vi.fn().mockImplementation(async (command: { input: Record<string, unknown>; constructor: { name: string } }) => {
    const commandName = command.constructor.name;
    const input = command.input;

    if (commandName === 'PutObjectCommand') {
      const key = input.Key as string;
      const body = input.Body as Buffer;
      const contentType = (input.ContentType as string) ?? 'application/octet-stream';
      objectStore.set(key, { key, body, contentType });
      return { ETag: `"mock-etag-${Date.now()}"` };
    }

    if (commandName === 'DeleteObjectCommand') {
      const key = input.Key as string;
      objectStore.delete(key);
      return {};
    }

    if (commandName === 'GetObjectCommand') {
      const key = input.Key as string;
      const obj = objectStore.get(key);
      if (!obj) {
        const err = new Error(`NoSuchKey: The specified key does not exist: ${key}`);
        (err as NodeJS.ErrnoException).code = 'NoSuchKey';
        throw err;
      }
      return {
        Body: {
          transformToByteArray: async () => new Uint8Array(obj.body),
          transformToString: async () => obj.body.toString(),
        },
        ContentType: obj.contentType,
        ContentLength: obj.body.length,
      };
    }

    if (commandName === 'HeadObjectCommand') {
      const key = input.Key as string;
      const obj = objectStore.get(key);
      if (!obj) {
        const err = new Error(`NotFound`);
        (err as NodeJS.ErrnoException).code = 'NotFound';
        throw err;
      }
      return {
        ContentType: obj.contentType,
        ContentLength: obj.body.length,
      };
    }

    throw new Error(`Unknown S3 command: ${commandName}`);
  }),
};

/**
 * Returns a list of all keys currently in the mock store.
 */
export function listMockObjects(): string[] {
  return Array.from(objectStore.keys());
}

/**
 * Checks if a key exists in the mock store.
 */
export function mockObjectExists(key: string): boolean {
  return objectStore.has(key);
}
