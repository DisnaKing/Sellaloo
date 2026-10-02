// Uso: npm run set-admin -- <correo>
import { auth } from './emulator.ts';

const email = process.argv[2];
if (!email) throw new Error('Uso: npm run set-admin -- <correo>');

const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
console.log(`${email} ya es admin. Tiene que volver a entrar para que se aplique.`);
