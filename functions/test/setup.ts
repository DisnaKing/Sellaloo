// Por seguridad, los tests de emulador nunca apuntan a un proyecto real: si no se lanzan con
// `firebase emulators:exec`, fallan al conectar en lugar de escribir en producción.
process.env.GCLOUD_PROJECT ??= 'demo-sellaloo';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

if (!process.env.GCLOUD_PROJECT.startsWith('demo-')) {
  throw new Error(`Los tests de emulador solo usan proyectos demo-*, no ${process.env.GCLOUD_PROJECT}.`);
}
