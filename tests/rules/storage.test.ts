import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const webp = { contentType: 'image/webp' };
const put = (uid: string | null, path: string, size = 1000, meta = webp) => {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  // `put` devuelve un UploadTask, que se puede esperar pero no es una Promise para TypeScript.
  return Promise.resolve(ctx.storage().ref(path).put(new Uint8Array(size), meta));
};

beforeAll(async () => {
  const [host, port] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-sellaloo',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(() => env.cleanup());

describe('logos', () => {
  it('el dueño sube su logo en WebP o JPEG y pequeño', async () => {
    await assertSucceeds(put('owner-1', 'logos/owner-1/logo.webp'));
    await assertSucceeds(put('owner-1', 'logos/owner-1/logo', 1000, { contentType: 'image/jpeg' }));
    await assertFails(put('owner-1', 'logos/owner-1/logo.webp', 200 * 1024));
    await assertFails(put('owner-1', 'logos/owner-1/logo.png', 1000, { contentType: 'image/png' }));
  });

  it('nadie sube el logo de otro', async () => {
    await assertFails(put('otro', 'logos/owner-1/logo.webp'));
    await assertFails(put(null, 'logos/owner-1/logo.webp'));
  });
});
