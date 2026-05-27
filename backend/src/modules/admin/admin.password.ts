import { createHmac } from 'node:crypto';

const DERIVATION_LABEL = 'baito-admin-password-v1';

export function deriveAdminPassword(email: string, secret: string) {
  const digest = createHmac('sha256', secret)
    .update(`${DERIVATION_LABEL}:${email.toLowerCase()}`)
    .digest('base64url');

  return `baito_${digest.slice(0, 32)}`;
}
