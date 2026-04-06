require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Groq = require('groq-sdk');
const OpenAI = require('openai');
// Suppression de nodemailer, utilisation exclusive de Brevo
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Stripe Webhook (raw body AVANT express.json) ─────────────────────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[stripe/webhook] STRIPE_WEBHOOK_SECRET non configuré');
    return res.status(400).json({ error: 'Webhook secret manquant' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configuré' });
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature invalide :', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceNumber = session.metadata?.invoice_number;

    if (invoiceNumber && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('number', invoiceNumber)
        .in('status', ['sent', 'overdue', 'draft']);

      if (error) {
        console.error(`[stripe/webhook] Erreur mise à jour facture ${invoiceNumber} :`, error.message);
      } else {
        console.log(`[stripe/webhook] Facture ${invoiceNumber} marquée payée ✓`);
      }
    }
  }

  res.json({ received: true });
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// Limite globale : 100 requêtes / 15 min par IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes.' },
});
// Limite spécifique sur le traitement vocal (coûteux en API externe)
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Limite de transcriptions atteinte, attendez 1 minute.' },
});
app.use(globalLimiter);
app.use('/api/process-voice', voiceLimiter);
app.use('/api/edit-voice-invoice', voiceLimiter);
app.use('/api/transcribe', voiceLimiter);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ─── Client Supabase Admin (auth + cron) ──────────────────────────────────────
let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  supabaseAdmin = createSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── Middleware d'authentification JWT Supabase ────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant.' });
  }
  if (!supabaseAdmin) {
    // Si Supabase admin non configuré, on passe (mode dev local)
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Erreur d\'authentification.' });
  }
}

// ─── Clients IA ───────────────────────────────────────────────────────────────
// Groq pour Whisper (transcription audio — gratuit)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// OpenRouter pour LLM (parsing IA — gratuit avec modèles :free)
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://factu.me',
    'X-Title': 'Factu.me',
  },
});

// ─── Helper email : Brevo API EXCLUSIF ──────────────────────────────────────────────
async function sendEmail({ to, toName, subject, htmlContent, fromName, pdfBase64, pdfFilename }) {
  const brevoKey = process.env.BREVO_API_KEY;

  if (!brevoKey) {
    throw new Error('BREVO_API_KEY non configurée. Impossible d\'envoyer l\'email.');
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@factu.me';
  const body = {
    sender: { name: fromName || 'Factu.me', email: senderEmail },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent,
  };
  
  if (pdfBase64 && pdfFilename) {
    body.attachment = [{ content: pdfBase64, name: pdfFilename }];
  }
  
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo API error ${res.status}`);
  }
  
  return { success: true, provider: 'brevo' };
}

const LLM_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

// ─── Contexte secteur → TVA et descriptions adaptés ───────────────────────────
function getSectorContext(sector) {
  if (!sector) return '';
  const sectorMap = {
    'Bâtiment & Travaux': 'TVA 10% pour rénovation (sauf amélioration énergétique 5.5%). Prestations typiques : maçonnerie, plomberie, électricité, peinture, carrelage, isolation.',
    'Plomberie': 'TVA 10% pour rénovation, 5.5% pour amélioration énergétique. Prestations : pose sanitaires, dépannage fuite, installation chauffe-eau.',
    'Électricité': 'TVA 10% pour rénovation. Prestations : installation tableau électrique, câblage, mise aux normes.',
    'Menuiserie': 'TVA 10% pour rénovation. Prestations : pose portes, fenêtres, parquet, escaliers.',
    'Peinture & Décoration': 'TVA 10% pour rénovation. Prestations : peinture intérieure/extérieure, enduits, papier peint.',
    'Restauration & Hôtellerie': 'TVA 10% sur la restauration. Prestations : repas, boissons, hébergement.',
    'Informatique & Tech': 'TVA 20%. Prestations : développement, maintenance, conseil, formation.',
    'Conseil & Formation': 'TVA 20%. Prestations : conseil stratégique, formation, coaching, audit.',
    'Santé & Bien-être': 'TVA 0% pour actes médicaux (médecin, infirmier). TVA 20% pour bien-être (coach, naturopathe).',
    'Transport & Livraison': 'TVA 20%. Prestations : transport de marchandises, livraison, déménagement.',
    'Jardinage & Paysagisme': 'TVA 10% pour entretien de jardins. Prestations : tonte, taille, création espaces verts.',
    'Nettoyage & Entretien': 'TVA 10% pour nettoyage chez particuliers. Prestations : ménage, nettoyage de vitres, entretien.',
    'Auto & Moto': 'TVA 20%. Prestations : réparation, entretien, contrôle technique.',
    'Coiffure & Beauté': 'TVA 20%. Prestations : coupe, coloration, soins, manucure.',
    'Photographie & Vidéo': 'TVA 20%. Prestations : reportage, shooting, montage, mariage.',
    'Communication & Marketing': 'TVA 20%. Prestations : création graphique, community management, rédaction, publicité.',
  };
  return sectorMap[sector] || `Secteur : ${sector}. TVA 20% par défaut.`;
}

// ─── ROUTE: Traitement vocal → JSON facture ────────────────────────────────────
app.post('/api/process-voice', requireAuth, upload.single('audio'), async (req, res) => {
  let audioPath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier audio manquant' });

    // Multer sauvegarde sans extension — Groq en a besoin pour détecter le format
    const ext = path.extname(req.file.originalname) || '.m4a';
    audioPath = req.file.path + ext;
    fs.renameSync(req.file.path, audioPath);

    const sector = req.body.sector || '';
    const sectorContext = getSectorContext(sector);

    // Étape 1 : Transcription avec Groq Whisper
    console.log('[Groq Whisper] Transcription en cours...');
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      language: 'fr',
      response_format: 'text',
    });
    const transcript = typeof transcription === 'string' ? transcription : (transcription.text || '');
    console.log('[Groq Whisper] :', transcript);

    // Étape 2 : Parsing avec OpenRouter LLM
    console.log(`[OpenRouter ${LLM_MODEL}] Extraction JSON... (secteur: ${sector || 'non défini'})`);
    const completion = await openrouter.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant de facturation français expert spécialisé dans le secteur "${sector || 'généraliste'}". Tu extrais des informations de facturation depuis une transcription vocale.${sectorContext ? ' ' + sectorContext : ''} Tu dois TOUJOURS répondre avec un JSON valide, rien d'autre. Pas d'introduction, pas d'explication, uniquement le JSON.`,
        },
        {
          role: 'user',
          content: `Extrais les informations de facturation de cette transcription et retourne UNIQUEMENT ce JSON :

Transcription : "${transcript}"
${sectorContext ? `\nContexte métier : ${sectorContext}` : ''}

JSON attendu :
{
  "client_name": "nom du client (string ou null si non mentionné)",
  "items": [
    {
      "description": "description de la prestation (utilise le vocabulaire professionnel du secteur)",
      "quantity": 1,
      "unit_price": 0,
      "vat_rate": 20
    }
  ],
  "notes": "notes additionnelles (string ou null)",
  "due_days": 30
}

Règles :
- TVA par défaut = 20%. 10% restauration/hôtellerie. 5.5% travaux rénovation. 0% si "sans TVA" mentionné.
- Adapte le taux de TVA selon le secteur métier si pertinent.
- Convertis les montants en nombres : "quatre cent cinquante euros" → 450
- Si quantité non mentionnée → 1
- due_days = délai de paiement (30 par défaut, 0 si "comptant" ou "immédiat")
- Réponds UNIQUEMENT avec le JSON, rien d'autre`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() || '{}';
    console.log('[OpenRouter] Réponse :', rawContent.slice(0, 300));

    let parsed;
    try {
      // Nettoyer les backticks markdown si présents
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[OpenRouter] Erreur JSON, fallback:', e.message);
      parsed = {
        client_name: null,
        items: [{ description: transcript, quantity: 1, unit_price: 0, vat_rate: 20 }],
        notes: null,
        due_days: 30,
      };
    }

    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    res.json({ transcript, parsed });
  } catch (error) {
    console.error('[process-voice] Erreur :', error.message);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    else if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Modification vocale d'une facture existante ──────────────────────
app.post('/api/edit-voice-invoice', requireAuth, upload.single('audio'), async (req, res) => {
  let audioPath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier audio manquant' });

    // Multer sauvegarde sans extension — Groq en a besoin pour detecter le format
    const ext = path.extname(req.file.originalname) || '.m4a';
    audioPath = req.file.path + ext;
    fs.renameSync(req.file.path, audioPath);

    const currentInvoiceJSON = req.body.invoice;
    if (!currentInvoiceJSON) {
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      return res.status(400).json({ error: 'Données de la facture manquantes' });
    }

    const currentInvoice = JSON.parse(currentInvoiceJSON);
    const sector = req.body.sector || '';
    const sectorContext = getSectorContext(sector);

    // Étape 1 : Transcription avec Groq Whisper
    console.log('[Groq Whisper] Transcription édition en cours...');
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      language: 'fr',
      response_format: 'text',
    });
    const transcript = typeof transcription === 'string' ? transcription : (transcription.text || '');
    console.log('[Groq Whisper] Transcript :', transcript);

    // Étape 2 : Parsing et modification avec OpenRouter LLM
    console.log(`[OpenRouter ${LLM_MODEL}] Application des modifications...`);
    const completion = await openrouter.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant de facturation français professionnel expert. Tu reçois un JSON d'une facture existante et une instruction vocale transcrite de l'utilisateur demandant de modifier ou d'ajouter/supprimer des éléments à cette facture.${sectorContext ? ' ' + sectorContext : ''} Tu dois appliquer les modifications demandées dans le JSON. Réponds TOUJOURS avec un JSON valide, rien d'autre. Pas d'introduction, uniquement le JSON mis à jour.`,
        },
        {
          role: 'user',
          content: `Facture actuelle :
${JSON.stringify(currentInvoice, null, 2)}

Instruction de modification : "${transcript}"
${sectorContext ? `\nContexte métier : ${sectorContext}` : ''}

Note : Si l'utilisateur demande d'ajouter un élément, ajoute-le à la liste "items". S'il demande de changer un prix, une quantité, un client, modifie l'objet existant. Garde tous les éléments qui n'ont pas été modifiés. Garde les IDs existants. Modifie le "due_days" si la date a changé (par rapport à la date d'émission).

Réponds UNIQUEMENT avec le JSON complet mis à jour, représentant l'objet avec la même structure :
{
  "client_name": string | null,
  "items": array of { description, quantity, unit_price, vat_rate, id (if exists) },
  "notes": string | null,
  "due_days": number (or date logic)
}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() || '{}';
    console.log('[OpenRouter] Réponse edit :', rawContent.slice(0, 300));

    let parsed;
    try {
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[OpenRouter Edit] Erreur JSON, fallback:', e.message);
      parsed = currentInvoice; // Fallback to original
    }

    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    res.json({ transcript, parsed });
  } catch (error) {
    console.error('[edit-voice-invoice] Erreur :', error.message);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    else if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Transcription seule ────────────────────────────────────────────────
app.post('/api/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier audio manquant' });

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      language: 'fr',
      response_format: 'text',
    });

    fs.unlinkSync(filePath);
    res.json({ transcript: typeof transcription === 'string' ? transcription : transcription.text });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Envoi de facture par email ────────────────────────────────────────
app.post('/api/send-invoice', requireAuth, async (req, res) => {
  try {
    const { to, toName, subject, htmlBody, pdfBase64, filename, fromName } = req.body;
    if (!to) return res.status(400).json({ error: 'Destinataire manquant' });

    const result = await sendEmail({
      to, toName, subject: subject || 'Votre facture',
      htmlContent: htmlBody || '<p>Veuillez trouver votre facture en pièce jointe.</p>',
      fromName, pdfBase64, pdfFilename: filename,
    });

    if (result.simulated) {
      console.log(`[Email] Simulation : envoi à ${to} — ${subject}`);
    } else {
      console.log(`[Email] Envoyé via ${result.provider} à ${to}`);
    }
    res.json(result);
  } catch (error) {
    console.error('[send-invoice] Erreur :', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Import clients depuis fichier (PDF/Excel/Word/CSV/TXT) ───────────
app.post('/api/import-clients', requireAuth, upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    filePath = req.file.path;

    const originalName = (req.file.originalname || '').toLowerCase();
    const ext = path.extname(originalName);
    const TEXT_LIMIT = 20000;

    const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const SPREADSHEET_EXTS = ['.xlsx', '.xls', '.ods', '.numbers'];
    const isImage = IMAGE_EXTS.includes(ext);

    const importModel = process.env.OPENROUTER_IMPORT_MODEL || LLM_MODEL;
    const visionModel = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-lite-001';

    const JSON_SCHEMA = `{
  "clients": [
    {
      "name": "nom ou raison sociale (obligatoire, string)",
      "email": "email si présent, sinon null",
      "phone": "téléphone si présent (format nettoyé), sinon null",
      "siret": "SIRET si présent (14 chiffres sans espaces), sinon null",
      "address": "adresse postale si présente, sinon null",
      "city": "ville si présente, sinon null",
      "postal_code": "code postal 5 chiffres si présent, sinon null",
      "vat_number": "numéro TVA intracommunautaire si présent (ex: FR12345678901), sinon null",
      "notes": "autres infos utiles si présentes, sinon null"
    }
  ]
}`;

    const RULES = `Règles strictes :
- Extrais UNIQUEMENT les entités distinctes (clients, entreprises, fournisseurs, contacts)
- Ne duplique pas les entrées (même client = une seule entrée)
- Si le document ne contient aucun client, retourne {"clients": []}
- Réponds UNIQUEMENT avec le JSON brut, sans markdown ni explication`;

    const SYSTEM_PROMPT = `Tu es un assistant expert en extraction de données clients depuis des documents professionnels. Tu extrais les informations clients et les structures en JSON. Tu réponds UNIQUEMENT avec un JSON valide, sans aucune explication ni texte autour.`;

    let completion;

    // ── Images → vision IA (base64) ──────────────────────────────────────────
    if (isImage) {
      const imageBuffer = fs.readFileSync(filePath);
      const base64 = imageBuffer.toString('base64');
      const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };
      const mimeType = mimeMap[ext] || 'image/jpeg';

      console.log(`[import-clients] Vision IA avec ${visionModel} (image ${ext}, ${Math.round(imageBuffer.length / 1024)}KB)`);

      completion = await openrouter.chat.completions.create({
        model: visionModel,
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              {
                type: 'text',
                text: `Extrais tous les clients/entreprises/contacts visibles dans cette image et retourne UNIQUEMENT ce JSON :\n\n${JSON_SCHEMA}\n\n${RULES}`,
              },
            ],
          },
        ],
      });

    // ── Texte/documents → extraction + IA ────────────────────────────────────
    } else {
      let textContent = '';

      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        textContent = (pdfData.text || '').slice(0, TEXT_LIMIT);

      } else if (SPREADSHEET_EXTS.includes(ext)) {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filePath);
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          textContent += XLSX.utils.sheet_to_csv(sheet) + '\n';
        });
        textContent = textContent.slice(0, TEXT_LIMIT);

      } else if (ext === '.docx' || ext === '.doc') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        textContent = (result.value || '').slice(0, TEXT_LIMIT);

      } else if (ext === '.vcf') {
        // vCard : garder les lignes utiles seulement
        const raw = fs.readFileSync(filePath, 'utf-8');
        const usefulLines = raw.split('\n').filter((l) =>
          /^(FN|N|EMAIL|TEL|ORG|ADR|URL|NOTE|X-)/i.test(l.trim())
        );
        textContent = usefulLines.join('\n').slice(0, TEXT_LIMIT);

      } else if (ext === '.json') {
        const raw = fs.readFileSync(filePath, 'utf-8');
        try {
          textContent = JSON.stringify(JSON.parse(raw), null, 2).slice(0, TEXT_LIMIT);
        } catch {
          textContent = raw.slice(0, TEXT_LIMIT);
        }

      } else {
        // CSV, TXT, XML, et tout autre format texte
        try {
          textContent = fs.readFileSync(filePath, 'utf-8').slice(0, TEXT_LIMIT);
        } catch {
          textContent = fs.readFileSync(filePath, 'latin1').slice(0, TEXT_LIMIT);
        }
      }

      if (!textContent.trim()) {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Impossible d\'extraire du texte de ce fichier.' });
      }

      console.log(`[import-clients] Extraction avec ${importModel} (${textContent.length} chars)`);

      completion = await openrouter.chat.completions.create({
        model: importModel,
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extrais tous les clients/entreprises/contacts présents dans ce document et retourne UNIQUEMENT ce JSON :\n\nContenu du document :\n"""\n${textContent}\n"""\n\n${JSON_SCHEMA}\n\n${RULES}`,
          },
        ],
      });
    }

    const rawContent = completion.choices[0]?.message?.content?.trim() || '{"clients":[]}';
    console.log('[import-clients] Réponse IA :', rawContent.slice(0, 200));

    let parsed;
    try {
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[import-clients] Erreur JSON parse, fallback vide');
      parsed = { clients: [] };
    }

    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const clients = (parsed.clients || []).filter((c) => c && c.name && c.name.trim());
    res.json({ clients, count: clients.length });

  } catch (error) {
    console.error('[import-clients] Erreur :', error.message);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    else if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Analyse PDF → Template HTML personnalisé ─────────────────────────
app.post('/api/analyze-template', requireAuth, upload.single('pdf'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier PDF manquant' });

    // Extraire le texte du PDF
    console.log('[analyze-template] Extraction du texte PDF...');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text?.slice(0, 3000) || '';
    console.log('[analyze-template] Texte extrait :', pdfText.slice(0, 200));

    if (!pdfText.trim()) {
      return res.status(400).json({ error: 'Impossible d\'extraire le texte du PDF. Assurez-vous que le PDF contient du texte (pas une image scannée).' });
    }

    // Demander au LLM de générer le template HTML
    console.log(`[analyze-template] Génération du template HTML avec ${LLM_MODEL}...`);
    const completion = await openrouter.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en design de factures HTML pour entreprises françaises. Tu génères des templates HTML de factures professionnels et élégants.`,
        },
        {
          role: 'user',
          content: `Voici le contenu texte d'une facture/document existant. Génère un template HTML complet qui reproduit sa structure, ses couleurs et son style professionnel.

Contenu du document :
"""
${pdfText}
"""

IMPORTANT : Utilise EXACTEMENT ces placeholders dans le HTML (ils seront remplacés par les vraies données) :
- {{COMPANY_NAME}} : nom de l'entreprise
- {{COMPANY_ADDRESS}} : adresse de l'entreprise
- {{SIRET}} : numéro SIRET
- {{INVOICE_NUMBER}} : numéro de facture
- {{INVOICE_DATE}} : date d'émission
- {{DUE_DATE}} : date d'échéance
- {{CLIENT_NAME}} : nom du client
- {{CLIENT_ADDRESS}} : adresse du client
- {{ITEMS_TABLE}} : tableau HTML des lignes de prestation
- {{SUBTOTAL}} : total HT
- {{VAT_AMOUNT}} : montant TVA
- {{TOTAL}} : total TTC
- {{NOTES}} : notes additionnelles
- {{LEGAL_MENTIONS}} : mentions légales
- {{DOCUMENT_TYPE}} : type de document (FACTURE, DEVIS, AVOIR) — utilise ce placeholder partout où apparaît le titre/type du document

Règles :
- HTML complet et auto-suffisant (inclure les styles CSS inline ou dans <style>)
- Design professionnel adapté à une facture française
- Réponds UNIQUEMENT avec le HTML complet, rien d'autre, pas de backticks`,
        },
      ],
    });

    let html = completion.choices[0]?.message?.content?.trim() || '';
    // Nettoyer les backticks markdown si présents
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Le modèle IA n\'a pas retourné un HTML valide. Réessayez.' });
    }

    console.log('[analyze-template] Template généré :', html.slice(0, 200));
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ html });
  } catch (error) {
    console.error('[analyze-template] Erreur :', error.message);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Génération PDF Factur-X (PDF/A-3 + XML embarqué) ─────────────────
// ─── Ghostscript PDF/A-3b ─────────────────────────────────────────────────────
let _gsBin = undefined;
async function getGhostscriptBin() {
  if (_gsBin !== undefined) return _gsBin;
  const bins = process.platform === 'win32' ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'];
  for (const bin of bins) {
    try { await execAsync(`${bin} --version`); _gsBin = bin; return bin; } catch {}
  }
  _gsBin = null;
  return null;
}

async function convertToPdfa3(inputPath) {
  const gs = await getGhostscriptBin();
  if (!gs) return null;
  const outputPath = path.join(os.tmpdir(), `pdfa3_${Date.now()}.pdf`);
  try {
    await promisify(execFile)(gs, [
      '-dPDFA=3', '-dBATCH', '-dNOPAUSE', '-dNOSAFER',
      '-sDEVICE=pdfwrite', '-dPDFACompatibilityPolicy=1',
      `-sOutputFile=${outputPath}`, inputPath,
    ]);
    return outputPath;
  } catch (err) {
    console.warn('[embed-facturx] Ghostscript PDF/A-3b échoué :', err.message);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return null;
  }
}

app.post('/api/embed-facturx', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, xmlContent, invoiceNumber, documentType } = req.body;
    if (!pdfBase64 || !xmlContent) {
      return res.status(400).json({ error: 'pdfBase64 et xmlContent requis' });
    }

    const { PDFDocument, PDFName, AFRelationship } = require('pdf-lib');

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const xmlBytes = Buffer.from(xmlContent, 'utf-8');

    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Métadonnées du document
    pdfDoc.setProducer("Factu.me");
    pdfDoc.setCreator("Factu.me — urn:factur-x.eu:1p0:en16931");

    // Attacher le XML Factur-X comme fichier embarqué
    // AFRelationship.Alternative est obligatoire selon la spec Factur-X
    await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
      mimeType: 'text/xml',
      description: 'Factur-X Invoice',
      creationDate: new Date(),
      modificationDate: new Date(),
      afRelationship: AFRelationship.Alternative,
    });

    // Métadonnées XMP Factur-X (PDF/A-3b)
    const docType = documentType === 'credit_note' ? 'CREDITNOTE' : 'INVOICE';
    const safeNumber = (invoiceNumber || 'Document').replace(/[<>&'"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c)
    );
    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:fx="urn:factur-x.eu:pdfa:CrossIndustryDocument:invoice:1p0#"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>${docType}</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
      <pdf:Producer>Factu.me</pdf:Producer>
      <dc:title>
        <rdf:Alt><rdf:li xml:lang="x-default">${safeNumber}</rdf:li></rdf:Alt>
      </dc:title>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const xmpBytes = Buffer.from(xmp, 'utf-8');
    const metadataStream = pdfDoc.context.stream(xmpBytes, { Type: 'Metadata', Subtype: 'XML' });
    const metadataRef = pdfDoc.context.register(metadataStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef);

    let resultBytes = await pdfDoc.save();

    // Tentative conversion PDF/A-3b via Ghostscript
    const tmpIn = path.join(os.tmpdir(), `fx_in_${Date.now()}.pdf`);
    fs.writeFileSync(tmpIn, resultBytes);
    const pdfa3Path = await convertToPdfa3(tmpIn);
    if (pdfa3Path) {
      resultBytes = fs.readFileSync(pdfa3Path);
      fs.unlinkSync(pdfa3Path);
      console.log(`[embed-facturx] PDF/A-3b OK via Ghostscript : ${invoiceNumber}`);
    } else {
      console.warn(`[embed-facturx] Ghostscript non dispo — PDF non PDF/A-3b certifié`);
    }
    fs.unlinkSync(tmpIn);

    console.log(`[embed-facturx] PDF Factur-X généré : ${invoiceNumber} (${resultBytes.length} bytes)`);
    return res.json({ pdfBase64: Buffer.from(resultBytes).toString('base64') });

  } catch (err) {
    console.error('[embed-facturx] Erreur :', err.message);
    return res.status(500).json({ error: err.message || 'Erreur génération Factur-X' });
  }
});

// ─── ROUTE: Chorus Pro — Dépôt facture e-invoicing ───────────────────────────
/**
 * Soumet un PDF Factur-X à Chorus Pro (PPF — portail public de facturation).
 * Gratuit pour tous. Obligatoire pour clients secteur public (B2G).
 * Pour 2026 : PPF de fallback pour B2B aussi.
 *
 * Prérequis : compte PISTE sur api.gouv.fr + compte Chorus Pro
 * Variables : CHORUS_PRO_CLIENT_ID, CHORUS_PRO_CLIENT_SECRET,
 *             CHORUS_PRO_LOGIN, CHORUS_PRO_PASSWORD
 *             CHORUS_PRO_SANDBOX=true (en dev)
 */
app.post('/api/chorus-pro/submit', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, invoiceNumber } = req.body;
    if (!pdfBase64 || !invoiceNumber) {
      return res.status(400).json({ error: 'pdfBase64 et invoiceNumber requis' });
    }

    const clientId = process.env.CHORUS_PRO_CLIENT_ID;
    const clientSecret = process.env.CHORUS_PRO_CLIENT_SECRET;
    const login = process.env.CHORUS_PRO_LOGIN;
    const password = process.env.CHORUS_PRO_PASSWORD;
    const sandbox = process.env.CHORUS_PRO_SANDBOX === 'true';

    if (!clientId || !clientSecret || !login || !password) {
      return res.status(503).json({
        error: 'Chorus Pro non configuré',
        detail: 'Ajoutez CHORUS_PRO_CLIENT_ID, CHORUS_PRO_CLIENT_SECRET, CHORUS_PRO_LOGIN, CHORUS_PRO_PASSWORD dans .env',
      });
    }

    // 1. OAuth2 PISTE — token client_credentials
    const oauthUrl = sandbox
      ? 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token'
      : 'https://oauth.piste.gouv.fr/api/oauth/token';

    const tokenRes = await fetch(oauthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'openid',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[chorus-pro] OAuth2 échoué :', err);
      return res.status(502).json({ error: 'Authentification PISTE échouée', detail: err });
    }

    const { access_token } = await tokenRes.json();

    // 2. Préparer le PDF pour l'upload
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const boundary = `----FactumeBoundary${Date.now()}`;
    const filename = `${invoiceNumber.replace(/[^A-Z0-9-]/gi, '_')}_facturx.pdf`;

    // Construire le multipart manuellement (fetch natif ne gère pas Buffer en FormData côté Node)
    const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="syntaxeFlux"\r\n\r\nFACTURX_1_0\r\n`;
    const part2 = `--${boundary}\r\nContent-Disposition: form-data; name="avecSignature"\r\n\r\nfalse\r\n`;
    const part3Header = `--${boundary}\r\nContent-Disposition: form-data; name="fichierFlux"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`;
    const part3Footer = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(part1),
      Buffer.from(part2),
      Buffer.from(part3Header),
      pdfBuffer,
      Buffer.from(part3Footer),
    ]);

    // 3. Dépôt sur Chorus Pro
    const submitUrl = sandbox
      ? 'https://sandbox-cpro.business.gouv.fr/cpro/factures/v1/deposer/flux'
      : 'https://cpro.business.gouv.fr/cpro/factures/v1/deposer/flux';

    const submitRes = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        cpro_account: Buffer.from(`${login}:${password}`).toString('base64'),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });

    const result = await submitRes.json();

    if (!submitRes.ok) {
      console.error('[chorus-pro] Dépôt échoué :', result);
      return res.status(submitRes.status).json({ error: result.messageErreur || 'Dépôt Chorus Pro échoué', detail: result });
    }

    console.log(`[chorus-pro] Facture déposée : ${invoiceNumber} — flux ${result.identifiantFlux}`);
    res.json({
      success: true,
      identifiantFlux: result.identifiantFlux,
      statut: result.codeRetour,
    });

  } catch (err) {
    console.error('[chorus-pro] Erreur :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROUTE: URL d'autorisation Stripe Connect ────────────────────────────────
app.get('/api/stripe/connect/url', requireAuth, (req, res) => {
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'STRIPE_CLIENT_ID non configuré sur le serveur' });

  const redirectUri = encodeURIComponent('factume://stripe-connect');
  const url = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&redirect_uri=${redirectUri}`;
  res.json({ url });
});

// ─── ROUTE: Échange du code OAuth Stripe Connect ──────────────────────────────
app.post('/api/stripe/connect/callback', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code OAuth manquant' });

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configuré' });

    const Stripe = require('stripe');
    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

    const response = await stripe.oauth.token({ grant_type: 'authorization_code', code });
    const stripeAccountId = response.stripe_user_id;

    console.log(`[stripe/connect] Compte connecté : ${stripeAccountId}`);
    res.json({ stripe_account_id: stripeAccountId });
  } catch (error) {
    console.error('[stripe/connect/callback] Erreur :', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Création lien de paiement Stripe ─────────────────────────────────
app.post('/api/stripe/payment-link', requireAuth, async (req, res) => {
  try {
    const { stripeAccountId, amount, currency, invoiceNumber, description } = req.body;
    if (!stripeAccountId) return res.status(400).json({ error: 'Compte Stripe non connecté' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configuré' });

    const Stripe = require('stripe');
    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

    const price = await stripe.prices.create(
      {
        unit_amount: Math.round(amount * 100),
        currency: currency || 'eur',
        product_data: { name: description || `Facture ${invoiceNumber}` },
      },
      { stripeAccount: stripeAccountId }
    );

    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoice_number: invoiceNumber || '' },
      },
      { stripeAccount: stripeAccountId }
    );

    console.log(`[stripe] Lien créé pour ${invoiceNumber} : ${paymentLink.url}`);
    res.json({ url: paymentLink.url });
  } catch (error) {
    console.error('[stripe/payment-link] Erreur :', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE: Suppression compte utilisateur (RGPD) ────────────────────────────
app.delete('/api/delete-account', requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin non configuré' });
  }
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non identifié' });
  }

  try {
    // Récupérer le profil pour supprimer le logo du stockage
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('logo_url, signature_url')
      .eq('id', userId)
      .single();

    // Supprimer les données métier
    await supabaseAdmin.from('invoices').delete().eq('user_id', userId);
    await supabaseAdmin.from('clients').delete().eq('user_id', userId);
    await supabaseAdmin.from('recurring_invoices').delete().eq('user_id', userId);

    // Supprimer les fichiers Storage (logo + signature)
    const filesToDelete = [];
    if (profile?.logo_url?.includes('/logos/')) filesToDelete.push(`${userId}/logo.jpg`);
    if (profile?.signature_url?.includes('/logos/')) filesToDelete.push(`${userId}/signature.png`);
    if (filesToDelete.length > 0) {
      await supabaseAdmin.storage.from('logos').remove(filesToDelete);
    }

    // Supprimer le profil
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Supprimer l'utilisateur auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    console.log(`[delete-account] Compte supprimé : ${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[delete-account] Erreur :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROUTE: Health check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    services: {
      groq_whisper: !!process.env.GROQ_API_KEY,
      openrouter_llm: !!process.env.OPENROUTER_API_KEY,
      llm_model: LLM_MODEL,
      smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    },
  });
});

// ─── CRON: Génération factures récurrentes + Rappels factures en retard ────────
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const cron = require('node-cron');
  const crypto = require('crypto');

  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Vérification des factures récurrentes...');
    const today = new Date().toISOString().split('T')[0];

    const { data: dues, error } = await supabaseAdmin
      .from('recurring_invoices')
      .select('*, client:clients(*), profile:profiles!user_id(*)')
      .lte('next_run_date', today)
      .eq('is_active', true);

    if (error) { console.error('[cron] Erreur lecture récurrentes:', error.message); return; }
    console.log(`[cron] ${dues?.length || 0} facture(s) récurrente(s) à générer.`);

    for (const rec of (dues || [])) {
      try {
        const items = (rec.items || []).map(i => ({ ...i, id: crypto.randomUUID() }));
        const subtotal = items.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);
        const vatAmount = items.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0) * ((i.vat_rate || 0) / 100), 0);

        // Générer numéro unique
        const datePrefix = today.replace(/-/g, '').slice(0, 6);
        const suffix = Math.floor(Math.random() * 9000 + 1000);
        const docPrefix = rec.document_type === 'quote' ? 'DEV' : rec.document_type === 'credit_note' ? 'AVO' : 'REC';
        const number = `${docPrefix}-${datePrefix}-${suffix}`;

        const { data: invoice, error: invErr } = await supabaseAdmin.from('invoices').insert({
          user_id: rec.user_id,
          client_id: rec.client_id || null,
          client_name_override: rec.client_name_override || null,
          document_type: rec.document_type || 'invoice',
          status: 'draft',
          issue_date: today,
          items: rec.items,
          subtotal,
          vat_amount: vatAmount,
          total: subtotal + vatAmount,
          notes: rec.notes || null,
          number,
        }).select().single();

        if (invErr) { console.error(`[cron] Erreur création facture pour ${rec.id}:`, invErr.message); continue; }
        console.log(`[cron] Facture créée : ${number}`);

        // Calculer prochaine date
        const next = new Date(rec.next_run_date);
        if (rec.frequency === 'weekly') next.setDate(next.getDate() + 7);
        else if (rec.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        else if (rec.frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
        else next.setFullYear(next.getFullYear() + 1);

        await supabaseAdmin.from('recurring_invoices').update({
          last_run_date: today,
          next_run_date: next.toISOString().split('T')[0],
        }).eq('id', rec.id);

        // Push notification Expo
        const pushToken = rec.profile?.expo_push_token;
        if (pushToken && pushToken.startsWith('ExponentPushToken')) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: pushToken,
              title: 'Factu.me — Facture récurrente',
              body: `Nouvelle facture générée pour ${rec.client?.name || rec.client_name_override || 'votre client'}.`,
              data: { invoiceId: invoice?.id },
            }),
          }).catch(e => console.error('[cron] Push notification erreur:', e.message));
        }

        // Auto-envoi email si activé
        if (rec.auto_send && rec.client?.email && (process.env.BREVO_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER))) {
          try {
            const clientName = rec.client?.name || rec.client_name_override || 'Client';
            const companyName = rec.profile?.company_name || 'Votre prestataire';
            const accentColor = rec.profile?.accent_color || '#1D9E75';
            const formattedTotal = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(subtotal + vatAmount);

            const itemsRows = (rec.items || []).map(item => {
              const total = (item.quantity || 1) * (item.unit_price || 0);
              return `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${item.description}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151">${item.quantity}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111827">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(total)}</td>
              </tr>`;
            }).join('');

            const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:24px;font-weight:900;color:${accentColor}">Factu.me</span>
    </div>
    <h2 style="color:#111827;margin-bottom:8px;">Facture ${number}</h2>
    <p style="color:#6b7280;margin-bottom:24px;">Bonjour,<br>Veuillez trouver ci-dessous votre facture <strong>${number}</strong> émise par <strong>${companyName}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Description</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Qté</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;">Total HT</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div style="text-align:right;font-size:18px;font-weight:700;color:${accentColor};margin-bottom:24px;">Total TTC : ${formattedTotal}</div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">Factu.me — Tu parles, on facture.</p>
  </div>
</body></html>`;

            await sendEmail({
              to: rec.client.email,
              toName: clientName,
              subject: `Facture ${number} — ${companyName}`,
              htmlContent: html,
              fromName: companyName,
            });

            // Marquer la facture comme envoyée
            await supabaseAdmin.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice?.id);
            console.log(`[cron] Email auto-envoyé à ${rec.client.email} pour ${number}`);
          } catch (mailErr) {
            console.error(`[cron] Erreur auto-envoi email pour ${number}:`, mailErr.message);
          }
        }
      } catch (err) {
        console.error(`[cron] Erreur traitement récurrente ${rec.id}:`, err.message);
      }
    }
  });

  // ── Rappels automatiques pour les factures en retard ──────────────────────
  cron.schedule('0 9 * * *', async () => {
    if (!process.env.BREVO_API_KEY && (!process.env.SMTP_HOST || !process.env.SMTP_USER)) return; // Email non configuré
    console.log('[cron-overdue] Vérification des factures en retard...');
    const today = new Date().toISOString().split('T')[0];

    const { data: overdueInvoices, error } = await supabaseAdmin
      .from('invoices')
      .select('*, client:clients(name, email), profile:profiles!user_id(company_name, email, accent_color)')
      .eq('status', 'sent')
      .eq('document_type', 'invoice')
      .lt('due_date', today);

    if (error) { console.error('[cron-overdue] Erreur lecture:', error.message); return; }
    console.log(`[cron-overdue] ${overdueInvoices?.length || 0} facture(s) en retard à relancer.`);

    // Marquer les factures comme 'overdue' dans la base
    for (const inv of (overdueInvoices || [])) {
      await supabaseAdmin.from('invoices').update({ status: 'overdue' }).eq('id', inv.id);
    }

    // Regrouper par utilisateur pour envoyer un seul email de récap
    const byUser = {};
    for (const inv of (overdueInvoices || [])) {
      const uid = inv.user_id;
      if (!byUser[uid]) byUser[uid] = { profile: inv.profile, invoices: [] };
      byUser[uid].invoices.push(inv);
    }

    if (!Object.keys(byUser).length) return;

    for (const [uid, { profile, invoices }] of Object.entries(byUser)) {
      if (!profile?.email) continue;
      const accentColor = profile.accent_color || '#1D9E75';
      const companyName = profile.company_name || 'Votre entreprise';
      const totalOverdue = invoices.reduce((s, i) => s + (i.total || 0), 0);
      const formattedTotal = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalOverdue);

      const rows = invoices.map(inv => {
        const clientName = inv.client?.name || inv.client_name_override || 'Client inconnu';
        const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(inv.total || 0);
        const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—';
        const daysLate = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000) : 0;
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">${inv.number}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${clientName}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${amount}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#EF4444;font-weight:600">${dueDate} (${daysLate}j)</td>
          </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:24px;font-weight:900;color:${accentColor}">Factu.me</span>
    </div>
    <h2 style="color:#111827;margin-bottom:8px;">⚠️ ${invoices.length} facture${invoices.length > 1 ? 's' : ''} en retard</h2>
    <p style="color:#6b7280;margin-bottom:24px;">Bonjour,<br>Vous avez <strong style="color:#EF4444">${invoices.length} facture${invoices.length > 1 ? 's' : ''} impayée${invoices.length > 1 ? 's' : ''}</strong> dont la date d'échéance est dépassée. Total en attente : <strong style="color:#EF4444">${formattedTotal}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">N°</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Client</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Montant</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Échéance</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#6b7280;font-size:13px;">Pensez à relancer vos clients directement depuis l'application Factu.me.</p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">Factu.me — Tu parles, on facture.</p>
  </div>
</body></html>`;

      try {
        await sendEmail({
          to: profile.email,
          subject: `⚠️ ${invoices.length} facture${invoices.length > 1 ? 's' : ''} en retard — ${formattedTotal} à encaisser`,
          htmlContent: html,
          fromName: 'Factu.me',
        });
        console.log(`[cron-overdue] Rappel envoyé à ${profile.email} (${invoices.length} factures, ${formattedTotal})`);
      } catch (mailErr) {
        console.error(`[cron-overdue] Erreur envoi à ${profile.email}:`, mailErr.message);
      }
    }
  });

  console.log('⏰ Cron récurrentes : actif (tous les jours à 8h00)');
  console.log('⏰ Cron rappels retard : actif (tous les jours à 9h00)');
} else {
  console.log('⚠️  Crons désactivés (SUPABASE_SERVICE_ROLE_KEY manquant)');
}

app.listen(PORT, () => {
  console.log(`\n🎙️  Factu.me Backend v1.0.0`);
  console.log(`📡 Serveur : http://localhost:${PORT}`);
  console.log(`\n   Groq Whisper   : ${process.env.GROQ_API_KEY ? '✅ OK' : '❌ Manquant → console.groq.com'}`);
  console.log(`   OpenRouter LLM : ${process.env.OPENROUTER_API_KEY ? '✅ OK' : '❌ Manquant → openrouter.ai'}`);
  console.log(`   Modèle         : ${LLM_MODEL}`);
  const emailStatus = process.env.BREVO_API_KEY ? '✅ Brevo API' : process.env.SMTP_HOST ? '✅ SMTP' : '⚠️  Non configuré (simulation)';
  console.log(`   Email          : ${emailStatus}`);
  console.log(`   Supabase Admin : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ OK' : '⚠️  Non configuré (cron désactivé)'}\n`);
});
