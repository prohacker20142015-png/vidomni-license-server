/**
 * lib/crypto.ts - Ed25519 Cryptographic Token Signer for VidOmni AI Studio Pro
 */

import crypto from 'crypto';

export const DEFAULT_VENDOR_PRIVATE_KEY_HEX =
  process.env.VENDOR_PRIVATE_KEY ||
  'c5621b8370aaf103f834476abc32ba85ef3dffd116e2626d917d0777f32d14e7';

export const DEFAULT_VENDOR_PUBLIC_KEY_HEX =
  process.env.VENDOR_PUBLIC_KEY ||
  'd3ad5e4309e966d9e4c301d0cf2ac5f646c8fb53da1051f8d3ad8fae4dc43c3a';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Signs a license payload using Ed25519 asymmetric cryptography.
 * Matches python cryptography.hazmat.primitives.asymmetric.ed25519 verification.
 */
export function signLicenseToken(payloadData: {
  license_id: string;
  license_key: string;
  machine_id: string;
  tier: string;
  issued_at: string;
  expires_at: string;
  expiry_epoch: number;
  max_accounts: number;
  max_concurrent_jobs: number;
  offline_grace_seconds?: number;
  features?: string[];
}): string {
  const header = {
    alg: 'ED25519',
    typ: 'VODL',
    ver: 1,
  };

  const payload = {
    license_id: payloadData.license_id,
    license_key: payloadData.license_key,
    machine_id: payloadData.machine_id.trim().toUpperCase(),
    tier: payloadData.tier.toLowerCase(),
    issued_at: payloadData.issued_at,
    expires_at: payloadData.expires_at,
    expiry_epoch: payloadData.expiry_epoch,
    max_accounts: payloadData.max_accounts,
    max_concurrent_jobs: payloadData.max_concurrent_jobs,
    offline_grace_seconds: payloadData.offline_grace_seconds || 604800, // 7 days
    features: payloadData.features || [
      'batch_render',
      'watermark_remover',
      'character_sync',
      'multi_account',
    ],
  };

  const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');

  const headerB64 = base64UrlEncode(headerBytes);
  const payloadB64 = base64UrlEncode(payloadBytes);

  const signableData = Buffer.from(`${headerB64}.${payloadB64}`, 'ascii');

  // Convert raw 32-byte Ed25519 private key into PKCS8 DER format
  const privHex = DEFAULT_VENDOR_PRIVATE_KEY_HEX.trim();
  const privBytes = Buffer.from(privHex, 'hex');
  const pkcs8DerPrefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8Der = Buffer.concat([pkcs8DerPrefix, privBytes]);

  const privateKey = crypto.createPrivateKey({
    key: pkcs8Der,
    format: 'der',
    type: 'pkcs8',
  });

  const signature = crypto.sign(null, signableData, privateKey);
  const sigB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}
