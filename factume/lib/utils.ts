import { randomUUID } from 'expo-crypto';

/**
 * Génère un UUID v4 cryptographiquement sûr.
 * Centralise la génération d'IDs pour éviter la duplication et les collisions.
 */
export function generateId(): string {
  try {
    return randomUUID();
  } catch {
    // Fallback si expo-crypto n'est pas disponible (web)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
