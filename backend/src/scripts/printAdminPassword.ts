import dotenv from 'dotenv';
import { deriveAdminPassword } from '../modules/admin/admin.password.js';

dotenv.config();

const email = process.env.ADMIN_EMAIL?.toLowerCase();
const secret = process.env.ADMIN_PASSWORD_DERIVE_SECRET;

if (!email) {
  console.error('ADMIN_EMAIL não configurado');
  process.exit(1);
}

if (!secret) {
  console.error('ADMIN_PASSWORD_DERIVE_SECRET não configurado');
  process.exit(1);
}

console.log(deriveAdminPassword(email, secret));
