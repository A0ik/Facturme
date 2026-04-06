import { ParsedVoiceInvoice } from '../types';
import { getAuthHeaders } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ─── Types de réponse ────────────────────────────────────────────────────────
interface ProcessVoiceResponse {
  transcript: string;
  parsed: ParsedVoiceInvoice;
}

interface HealthResponse {
  status: string;
  version: string;
  services: {
    openai: boolean;
    anthropic: boolean;
    smtp: boolean;
  };
}

// ─── Helper de requête (avec auth JWT automatique) ───────────────────────────
async function fetchApi<T>(endpoint: string, options: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Traitement vocal ────────────────────────────────────────────────────────
export async function processVoice(audioUri: string, sector?: string): Promise<ProcessVoiceResponse> {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as unknown as Blob);

  if (sector) {
    formData.append('sector', sector);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/process-voice`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Transcription simple (mémos vocaux clients) ────────────────────────────
export async function transcribeAudio(audioUri: string): Promise<{ transcript: string }> {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'memo.m4a',
  } as unknown as Blob);
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/transcribe`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ─── Edition vocale d'une facture existante ──────────────────────────────────
export async function editVoiceInvoice(
  audioUri: string,
  currentInvoice: ParsedVoiceInvoice,
  sector?: string
): Promise<ProcessVoiceResponse> {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'edit-recording.m4a',
  } as unknown as Blob);

  formData.append('invoice', JSON.stringify(currentInvoice));

  if (sector) {
    formData.append('sector', sector);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/edit-voice-invoice`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Envoi de facture par email ──────────────────────────────────────────────
export async function sendInvoiceByEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  pdfBase64?: string;
  filename?: string;
  fromName?: string;
  fromEmail?: string;
}): Promise<{ success: boolean; simulated?: boolean }> {
  return fetchApi('/api/send-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

// ─── Analyse PDF → Template HTML personnalisé ────────────────────────────────
export async function analyzeTemplate(pdfUri: string): Promise<{ html: string }> {
  const formData = new FormData();
  formData.append('pdf', {
    uri: pdfUri,
    type: 'application/pdf',
    name: 'template.pdf',
  } as unknown as Blob);

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/analyze-template`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Génération PDF Factur-X (XML embarqué) ──────────────────────────────────
export async function embedFacturX(params: {
  pdfBase64: string;
  xmlContent: string;
  invoiceNumber: string;
  documentType?: string;
}): Promise<{ pdfBase64: string }> {
  return fetchApi('/api/embed-facturx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

// ─── Chorus Pro — Dépôt e-invoicing ──────────────────────────────────────────
export async function submitToChorusPro(params: {
  pdfBase64: string;
  invoiceNumber: string;
}): Promise<{ success: boolean; identifiantFlux: string; statut: string }> {
  return fetchApi('/api/chorus-pro/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

// ─── Stripe Connect — URL d'autorisation ─────────────────────────────────────
export async function getStripeConnectUrl(): Promise<{ url: string }> {
  return fetchApi('/api/stripe/connect/url', { method: 'GET' });
}

// ─── Stripe Connect — Échange du code OAuth ──────────────────────────────────
export async function exchangeStripeCode(code: string): Promise<{ stripe_account_id: string }> {
  return fetchApi('/api/stripe/connect/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

// ─── Création lien de paiement Stripe ────────────────────────────────────────
export async function createStripePaymentLink(params: {
  stripeAccountId: string;
  amount: number;
  invoiceNumber: string;
  description?: string;
  currency?: string;
}): Promise<{ url: string }> {
  return fetchApi('/api/stripe/payment-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

// ─── Import clients depuis fichier ───────────────────────────────────────────
export interface ImportedClient {
  name: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  vat_number: string | null;
  notes: string | null;
}

export async function importClientsFromFile(
  fileUri: string,
  fileName: string,
  mimeType?: string
): Promise<{ clients: ImportedClient[]; count: number }> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: mimeType || 'application/octet-stream',
    name: fileName,
  } as unknown as Blob);

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/import-clients`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Suppression compte (RGPD) ───────────────────────────────────────────────
export async function deleteAccount(): Promise<{ success: boolean }> {
  return fetchApi('/api/delete-account', { method: 'DELETE' });
}

// ─── Health check ────────────────────────────────────────────────────────────
export async function checkBackendHealth(): Promise<HealthResponse> {
  return fetchApi('/api/health', { method: 'GET' });
}
