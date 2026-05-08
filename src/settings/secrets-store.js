import { readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const GLOBAL_SLUG = "global";
const PBKDF2_SALT = "rha-tools-secrets-v1";

async function resolveGlobalPath(filename) {
  const base = await appDataDir();
  const dir = await join(base, GLOBAL_SLUG);
  await mkdir(dir, { recursive: true });
  return join(dir, filename);
}

export async function getOrCreateDeviceKey() {
  const path = await resolveGlobalPath("config.json");
  let config = {};
  try {
    const text = await readTextFile(path);
    config = JSON.parse(text);
  } catch { /* file doesn't exist yet */ }

  if (!config.deviceKey) {
    config.deviceKey = crypto.randomUUID();
    await writeTextFile(path, JSON.stringify(config, null, 2));
  }

  return config.deviceKey;
}

export async function deriveKey(deviceKey) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(deviceKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(PBKDF2_SALT),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptValue(cryptoKey, plaintext) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(plaintext),
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
  };
}

async function decryptValue(cryptoKey, iv, ct) {
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ctBytes = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
  const plain = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    cryptoKey,
    ctBytes,
  );
  return new TextDecoder().decode(plain);
}

export async function loadSecrets(cryptoKey) {
  const path = await resolveGlobalPath("secrets.json");
  let entries = [];
  try {
    const text = await readTextFile(path);
    entries = JSON.parse(text);
  } catch { /* file doesn't exist yet */ }

  const map = new Map();
  for (const entry of entries) {
    try {
      const value = await decryptValue(cryptoKey, entry.iv, entry.ct);
      map.set(entry.name, value);
    } catch {
      console.warn(`[secrets] Failed to decrypt "${entry.name}" — skipping`);
    }
  }
  return map;
}

export async function saveSecrets(cryptoKey, secretsMap) {
  const path = await resolveGlobalPath("secrets.json");
  const entries = [];
  for (const [name, value] of secretsMap) {
    const { iv, ct } = await encryptValue(cryptoKey, value);
    entries.push({ name, iv, ct });
  }
  await writeTextFile(path, JSON.stringify(entries, null, 2));
}
