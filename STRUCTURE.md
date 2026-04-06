# DictaBill — Structure Complète du Projet

> Analysé le 17 mars 2026

---

## 1. ARBORESCENCE DES FICHIERS

```
DictaBill-main/
├── factume/                          # App mobile (Expo React Native)
│   ├── app/
│   │   ├── _layout.tsx                 # Root layout (fonts, navigation, auth guard)
│   │   ├── index.tsx                   # Guard de route (redirige → auth ou app)
│   │   ├── (auth)/                     # Routes non-authentifiées
│   │   │   ├── _layout.tsx             # Layout auth
│   │   │   ├── welcome.tsx             # Page d'accueil (OAuth Google/Apple + email)
│   │   │   ├── login.tsx               # Connexion email/mot de passe
│   │   │   ├── register.tsx            # Inscription email/mot de passe
│   │   │   └── onboarding/
│   │   │       ├── company.tsx         # Étape 1 : infos société + lookup SIRET
│   │   │       ├── template.tsx        # Étape 2 : choix template + couleur + logo
│   │   │       ├── language.tsx        # Étape 3 : choix langue (FR/EN)
│   │   │       ├── first-client.tsx    # Étape 4 : création premier client
│   │   │       └── done.tsx            # Étape 5 : confirmation onboarding terminé
│   │   └── (app)/                      # Routes authentifiées
│   │       ├── _layout.tsx             # Layout app (vérifie onboarding)
│   │       ├── paywall.tsx             # Page d'upgrade abonnement
│   │       ├── (tabs)/                 # Navigation par onglets
│   │       │   ├── _layout.tsx         # Config des tabs (icônes, couleurs)
│   │       │   ├── index.tsx           # Dashboard (revenus, stats, dernières factures)
│   │       │   ├── invoices.tsx        # Liste factures/avoirs/devis + filtres
│   │       │   ├── clients.tsx         # Annuaire clients + recherche
│   │       │   └── settings.tsx        # Profil, templates, Stripe Connect, plan
│   │       ├── invoice/
│   │       │   ├── new.tsx             # Création document (voix → formulaire → confirmation)
│   │       │   └── [id].tsx            # Détail/édition document (voix + manuel)
│   │       ├── client/
│   │       │   ├── new.tsx             # Création client
│   │       │   └── [id].tsx            # Détail client + historique factures
│   │       └── recurring/
│   │           ├── index.tsx           # Liste des factures récurrentes
│   │           └── new.tsx             # Création facture récurrente
│   │
│   ├── components/
│   │   ├── VoiceRecorder.tsx           # Enregistrement audio + animation waveform
│   │   │                               # Props : onRecordingComplete, disabled, mode ('create'|'edit')
│   │   ├── InvoiceCard.tsx             # Carte facture (liste)
│   │   ├── ClientCard.tsx              # Carte client (liste)
│   │   └── ui/
│   │       ├── Button.tsx              # Bouton stylisé (primary/secondary/danger/outline)
│   │       ├── Input.tsx               # Input texte avec label + message d'erreur
│   │       └── Badge.tsx               # Badge statut (payé, envoyé, brouillon…)
│   │
│   ├── stores/
│   │   ├── authStore.ts                # État auth Zustand (user, profile, OAuth)
│   │   └── dataStore.ts                # État données Zustand (factures, clients, stats)
│   │
│   ├── lib/
│   │   ├── api.ts                      # Appels vers le backend Express
│   │   ├── supabase.ts                 # Client Supabase (AsyncStorage persistence)
│   │   ├── pdf.ts                      # Génération PDF (3 templates HTML → expo-print)
│   │   ├── xml.ts                      # Génération XML Factur-X (EN 16931 / CII)
│   │   └── sirene.ts                   # Lookup SIRET via API Sirène gouvernementale
│   │
│   ├── hooks/
│   │   └── useSubscription.ts          # Feature flags selon tier (free/solo/pro)
│   │
│   ├── types/
│   │   └── index.ts                    # Interfaces TypeScript (Invoice, Client, Profile…)
│   │
│   ├── constants/
│   │   └── Colors.ts                   # Design tokens (couleurs, tailles, espacements)
│   │
│   ├── i18n/
│   │   ├── index.ts                    # Configuration i18next (FR/EN)
│   │   ├── fr.ts                       # Traductions françaises
│   │   └── en.ts                       # Traductions anglaises
│   │
│   ├── supabase/
│   │   ├── schema.sql                  # Schéma BDD complet (tables, RLS, triggers)
│   │   └── migration_fix.sql           # Correctifs de migration
│   │
│   ├── assets/                         # ⚠️ DOSSIER POTENTIELLEMENT VIDE
│   │   ├── icon.png                    # ⚠️ MANQUANT — blocage build EAS
│   │   ├── splash-icon.png             # ⚠️ MANQUANT — blocage build EAS
│   │   ├── adaptive-icon.png           # ⚠️ MANQUANT — icône Android
│   │   └── favicon.png                 # ⚠️ MANQUANT — version web
│   │
│   ├── .env                            # ⚠️ SECRETS EXPOSÉS (voir §8 Sécurité)
│   ├── app.json                        # Configuration Expo (SDK 54)
│   ├── babel.config.js                 # Babel (reanimated plugin)
│   ├── tsconfig.json                   # TypeScript strict mode
│   └── package.json                    # Dépendances frontend
│
├── factume-backend/                  # API Node.js/Express
│   ├── server.js                       # Serveur Express (point d'entrée unique)
│   ├── .env                            # ⚠️ SECRETS EXPOSÉS (voir §8 Sécurité)
│   ├── package.json                    # Dépendances backend
│   └── uploads/                        # Fichiers audio temporaires (multer, nettoyés après traitement)
│
├── dictabill-plan.jsx                  # Document de planification produit
├── package.json                        # Workspace root (scripts concurrently)
├── package-lock.json
├── README.md
└── STRUCTURE.md                        # Ce fichier
```

---

## 2. STACK TECHNIQUE

### Frontend (factume/)

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| Framework | Expo + React Native | SDK 54 | iOS/Android cross-platform |
| Routing | expo-router | ~6.0.23 | Routing fichier (groupes auth/app/tabs) |
| État global | Zustand | ^5.0.3 | authStore + dataStore |
| Audio | expo-av | ~16.0.8 | Enregistrement .m4a (AAC 44.1kHz) |
| Animations | react-native-reanimated | ~4.1.1 | Waveform animée pendant enregistrement |
| PDF | expo-print | ~15.0.8 | HTML → PDF natif |
| Partage | expo-sharing | — | Partage PDF natif |
| Storage | @react-native-async-storage | 2.2.0 | Persistance session JWT |
| Base de données | @supabase/supabase-js | ^2.46.2 | PostgreSQL + Auth + RLS |
| Icônes | @expo/vector-icons (Ionicons) | — | 220+ icônes |
| Date Picker | @react-native-community/datetimepicker | 8.4.4 | Sélection date |
| Image | expo-image-picker | ~17.0.10 | Upload logo entreprise |
| Safe Area | react-native-safe-area-context | ~5.6.0 | Gestion encoche |
| Browser | expo-web-browser | ~15.0.10 | Redirects OAuth |
| i18n | i18next + react-i18next | ^23.16.8 | Localisation FR/EN |

### Backend (factume-backend/)

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Serveur | Express.js | API REST |
| Transcription | Groq SDK (Whisper Large v3) | Parole → texte (français) |
| LLM | OpenAI SDK via OpenRouter | Extraction + modification données facture |
| PDF | pdf-lib | Embedding XML Factur-X dans PDF |
| PDF parse | pdf-parse | Analyse template PDF custom |
| Email | Nodemailer | Envoi factures/relances (SMTP) |
| Upload | Multer | Fichiers audio (25MB max) et PDF |
| Paiements | stripe | Stripe Connect + payment links |
| Sécurité | helmet | En-têtes HTTP sécurisés |
| Rate limiting | express-rate-limit | Protection abus (100 req/15min global, 10 req/min voix) |
| Planification | node-cron | Factures récurrentes (cron 8h quotidien) |
| Config | dotenv | Variables d'environnement |

### Infrastructure

| Service | Usage | Tier |
|---------|-------|------|
| Supabase | PostgreSQL + Auth + RLS | Free (MVP) |
| Groq | Transcription Whisper Large v3 | Free (7 200 s/j) |
| OpenRouter | LLM Llama 3.1 8B parsing | Free (modèle :free) |
| API Sirène | Lookup SIRET | Gratuit, sans auth |
| Stripe | Paiements Connect + payment links | Production requis |

---

## 3. BASE DE DONNÉES (Supabase PostgreSQL)

### Table `profiles`
```sql
id              UUID  PK  → auth.users
email           TEXT
company_name    TEXT
siret           TEXT
address         TEXT
city            TEXT
postal_code     TEXT
country         TEXT  DEFAULT 'France'
phone           TEXT
vat_number      TEXT
logo_url        TEXT
template_id     INT   DEFAULT 1  -- (1=Minimaliste, 2=Classique, 3=Moderne, 4=Custom)
accent_color    TEXT  DEFAULT '#1D9E75'
legal_status    TEXT  -- (SAS, SARL, auto-entrepreneur…)
sector          TEXT  -- (Contexte TVA adapté côté LLM)
subscription_tier TEXT DEFAULT 'free'  -- (free/solo/pro)
invoice_count   INT   DEFAULT 0  -- Compteur global (numérotation)
invoice_prefix  TEXT  DEFAULT 'FACT'  -- Préfixe configurable
monthly_invoice_count INT DEFAULT 0  -- Quota mensuel plan gratuit
invoice_month   TEXT  -- YYYY-MM pour reset mensuel
onboarding_done BOOL  DEFAULT false
stripe_account_id TEXT
expo_push_token TEXT
language        TEXT  DEFAULT 'fr'  -- (fr/en)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Table `clients`
```sql
id          UUID  PK
user_id     UUID  FK → profiles
name        TEXT
email       TEXT
phone       TEXT
siret       TEXT
address     TEXT
city        TEXT
postal_code TEXT
country     TEXT
vat_number  TEXT
notes       TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### Table `invoices`
```sql
id                    UUID  PK
user_id               UUID  FK → profiles
client_id             UUID  FK → clients (nullable)
client_name_override  TEXT  -- Si client non enregistré
number                TEXT  -- (FACT-2026-001 / DEVIS-2026-001 / AVOIR-2026-001)
document_type         TEXT  CHECK IN ('invoice', 'quote', 'credit_note')
status                TEXT  CHECK IN ('draft','sent','paid','overdue','accepted','refused')
issue_date            DATE
due_date              DATE  (nullable)
items                 JSONB -- [{id, description, quantity, unit_price, vat_rate, total}]
subtotal              DECIMAL(12,2)
vat_amount            DECIMAL(12,2)
total                 DECIMAL(12,2)
notes                 TEXT  (nullable)
pdf_url               TEXT  (nullable)
payment_link          TEXT  (nullable — lien Stripe)
voice_transcript      TEXT  (nullable — transcription originale)
linked_invoice_id     UUID  FK → invoices (nullable — devis → facture)
sent_at               TIMESTAMPTZ
paid_at               TIMESTAMPTZ
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

**Numérotation automatique :**
- `invoice` → `{invoice_prefix}-{YYYY}-{NNN}` (ex: FACT-2026-001)
- `quote` → `DEVIS-{YYYY}-{NNN}`
- `credit_note` → `AVOIR-{YYYY}-{NNN}`

**Workflow statuts :**
- Facture : `draft` → `sent` → `paid` (ou `overdue` si échéance dépassée)
- Devis : `draft` → `sent` → `accepted` / `refused` (+ conversion en facture)
- Avoir : `draft` → `sent`

### Table `recurring_invoices`
```sql
id            UUID  PK
user_id       UUID  FK → profiles
client_id     UUID  FK → clients (nullable)
document_type TEXT
frequency     TEXT  CHECK IN ('weekly','monthly','quarterly','yearly')
items         JSONB
notes         TEXT
next_run_date DATE
last_run_date DATE
is_active     BOOL  DEFAULT true
auto_send     BOOL  DEFAULT false
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

### Sécurité (RLS)
- Politique par opération (SELECT/INSERT/UPDATE/DELETE)
- Chaque utilisateur n'accède qu'à ses propres données (`auth.uid() = user_id`)
- Trigger auto-création profil à l'inscription
- Trigger auto-mise à jour `updated_at`

---

## 4. ROUTES API BACKEND

| Méthode | Route | Rôle | Rate limit |
|---------|-------|------|-----------|
| POST | `/api/process-voice` | Upload audio → Groq Whisper → LLM → JSON facture | 10/min |
| POST | `/api/edit-voice-invoice` | Upload audio → modif facture existante par voix | 10/min |
| POST | `/api/transcribe` | Transcription seule (Groq Whisper) | 10/min |
| POST | `/api/send-invoice` | Envoi email avec PDF en pièce jointe (Nodemailer) | 100/15min |
| POST | `/api/analyze-template` | Analyse PDF → génère template HTML custom (LLM) | 100/15min |
| POST | `/api/embed-facturx` | Embedding XML Factur-X dans PDF (pdf-lib) | 100/15min |
| GET | `/api/stripe/connect/url` | URL OAuth Stripe Connect | 100/15min |
| POST | `/api/stripe/connect/callback` | Échange code OAuth → stripe_account_id | 100/15min |
| POST | `/api/stripe/payment-link` | Crée lien de paiement Stripe | 100/15min |
| GET | `/api/health` | État du serveur + services configurés | 100/15min |

---

## 5. PIPELINE VOCAL — Création et Édition

### Création (voix → nouvelle facture)

```
1. VoiceRecorder.tsx (mode='create')
   └── expo-av enregistre .m4a (44.1kHz, 128kbps)

2. api.ts → POST /api/process-voice
   ├── FormData : { audio, sector }
   └── Multer sauvegarde dans uploads/ + rename avec extension

3. server.js
   ├── Groq Whisper Large v3 → transcription texte FR
   └── OpenRouter LLM (Llama 3.1 8B) → JSON structuré
       { client_name, items[], due_days, notes }
       (TVA adaptée au secteur via getSectorContext())

4. invoice/new.tsx
   └── Pré-remplit le formulaire avec le JSON parsé
   └── Utilisateur peut corriger manuellement

5. dataStore.ts → createInvoice()
   ├── Génère numéro document (FACT/DEVIS/AVOIR-YYYY-NNN)
   ├── Calcule subtotal, vat_amount, total par item
   ├── Incrémente invoice_count + monthly_invoice_count
   └── Supabase INSERT dans invoices

6. pdf.ts → generateAndSharePdf()
   └── Template HTML (1–4) → expo-print → base64 PDF → partage natif

7. (Optionnel Pro) xml.ts → generateFacturX()
   └── XML EN 16931 → api.ts → POST /api/embed-facturx → PDF/A-3
```

### Édition vocale (voix → modifier facture existante)

```
1. invoice/[id].tsx — mode édition
   └── Bouton "Modifier par la voix" (accessible en mode lecture)
   └── VoiceRecorder.tsx (mode='edit')
       └── expo-av enregistre .m4a

2. handleEditRecordingComplete()
   ├── Construit currentInvoiceData depuis l'état d'édition
   └── api.ts → editVoiceInvoice() → POST /api/edit-voice-invoice
       FormData : { audio, invoice (JSON actuel), sector }

3. server.js /api/edit-voice-invoice
   ├── Groq Whisper → transcription de l'instruction vocale
   └── OpenRouter LLM → applique modifications sur JSON existant
       (ajouter/modifier/supprimer items, changer client, prix, notes)
       Fallback : retourne JSON original en cas d'erreur parse

4. Frontend
   ├── Met à jour editItems, editClientName, editNotes, editDueDate
   ├── Affiche transcript + résumé des changements
   └── Utilisateur vérifie et sauvegarde (ou continue à éditer)

5. handleSaveEdit() → updateInvoice()
   ├── Recalcule totaux (subtotal, vat_amount, total)
   └── Supabase UPDATE invoices SET items=…, total=…, updated_at=now()
```

---

## 6. GÉNÉRATION PDF

### Templates disponibles (pdf.ts)

| ID | Nom | Caractéristiques |
|----|-----|-----------------|
| 1 | Minimaliste | Design épuré, typographie claire |
| 2 | Classique | Professionnel, séparateur couleur accent |
| 3 | Moderne | En-tête sombre, design contemporain |
| 4 | Custom | Template HTML généré par IA depuis PDF uploadé |

### Labels selon type de document
- **Facture** : "Émise le", "Échéance", "Total TTC"
- **Devis** : "Établi le", "Valable jusqu'au", "Montant de l'offre", bloc signature
- **Avoir** : "Émis le", "Montant du crédit"

### Factur-X (Pro)
- Format XML : CII UN/CEFACT (Cross Industry Invoice)
- TypeCode : 380 (facture), 381 (avoir)
- Conformité : EN 16931 (e-facturation française 2026)
- Embedding : PDF/A-3 avec métadonnées XMP via pdf-lib

---

## 7. FEATURES PAR ABONNEMENT

| Feature | Free | Solo | Pro |
|---------|:----:|:----:|:---:|
| Création factures | 5/mois | ∞ | ∞ |
| Transcription voix | ✓ | ✓ | ✓ |
| Édition vocale | ✓ | ✓ | ✓ |
| Génération PDF | ✓ | ✓ | ✓ |
| Templates | 1 | 5 | 5 |
| Suppression watermark | ✗ | ✓ | ✓ |
| Export CSV | ✗ | ✓ | ✓ |
| Relances automatiques | ✗ | ✓ | ✓ |
| Template custom (PDF → IA) | ✗ | ✓ | ✓ |
| Paiements Stripe Connect | ✗ | ✗ | ✓ |
| WhatsApp Business | ✗ | ✗ | ✓ |
| Factur-X (e-invoicing) | ✗ | ✗ | ✓ |
| Multi-utilisateurs (5) | ✗ | ✗ | ✓ |
| Accès API | ✗ | ✗ | ✓ |

---

## 8. BUGS ET PROBLÈMES DÉTECTÉS

### 🔴 CRITIQUE — Sécurité

| # | Problème | Fichier | Impact |
|---|---------|---------|--------|
| 1 | **Clés API exposées dans .env commité** | `factume-backend/.env` | Compromission Groq + OpenRouter + SMTP |
| 2 | **Clé Supabase exposée** | `factume/.env` | Accès BDD si RLS mal configuré |
| 3 | **CORS = `"*"`** | `server.js` | Toute origine peut appeler l'API |

**Actions immédiates :**
- Révoquer et régénérer GROQ_API_KEY, OPENROUTER_API_KEY
- Ajouter `.env` au `.gitignore` + créer `.env.example` avec valeurs fictives

---

### 🟠 ÉLEVÉ — Blocage build / Runtime

| # | Problème | Fichier | Impact |
|---|---------|---------|--------|
| 4 | **Assets manquants** : icon.png, splash-icon.png | `factume/assets/` | **Build EAS bloque** |
| 5 | **UUID non cryptographique** | `dataStore.ts` | Collisions possibles (`Math.random()`) |
| 6 | **Fetch sans timeout** | `api.ts` | Requêtes suspendues si backend down |

---

### 🟡 MOYEN — Comportement incorrect

| # | Problème | Fichier | Impact |
|---|---------|---------|--------|
| 7 | **Stripe webhooks absents** | `server.js` | Statut facture jamais mis à jour en "payé" auto |
| 8 | **Logique abonnement Stripe manquante** | `server.js` + `settings.tsx` | Impossible de passer en Solo/Pro via l'app |
| 9 | **Mode simulation email silencieux** | `server.js` | Faux positifs côté UX (envoi simulé = vrai envoi pour l'utilisateur) |
| 10 | **Race condition profil** | `schema.sql` | Trigger `handle_new_user` peut échouer si email non dispo |

---

### 🔵 FAIBLE — Dette technique

| # | Problème | Fichier | Impact |
|---|---------|---------|--------|
| 11 | **@react-native-community/datetimepicker** déprécié | `package.json` | Incompatibilité future |
| 12 | **Aucun Error Boundary React** | Global | Crashs silencieux sans fallback |
| 13 | **Aucun test** (unitaire ou E2E) | Tout le projet | Régressions non détectées |
| 14 | **Export CSV/FEC non implémenté** | Feature Solo | Feature payante non disponible |
| 15 | **WhatsApp Business non intégré** | Feature Pro | Feature payante non disponible |
| 16 | **Relances automatiques non implémentées** | Feature Solo/Pro | Backend cron OK, UI manquante |

---

## 9. VARIABLES D'ENVIRONNEMENT REQUISES

### factume/.env
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.x:3000  # dev local
# Production : EXPO_PUBLIC_BACKEND_URL=https://ton-backend.railway.app
```

### factume-backend/.env
```env
PORT=3000
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ton@email.com
SMTP_PASS=xxxx xxxx xxxx xxxx
STRIPE_SECRET_KEY=sk_live_...
STRIPE_CONNECT_CLIENT_ID=ca_...
CORS_ORIGIN=https://ton-domaine.com  # ou * en dev
```

---

## 10. DÉPENDANCES MANQUANTES (recommandées)

### Frontend
```bash
# UUID sécurisé (remplace Math.random() dans dataStore.ts)
npx expo install expo-crypto

# Gestion des erreurs React
npm install react-error-boundary

# Validations (optionnel)
npm install zod
```

### Backend
```bash
# Validation entrées backend
npm install zod
# ou
npm install joi
```

---

## 11. SYNTHÈSE

### Points forts
- Architecture claire (Expo Router groups, Zustand stores séparés auth/data)
- Pipeline voix → facture complet et fonctionnel (création ET édition vocale)
- Édition vocale accessible directement en mode lecture (bouton "Modifier par la voix")
- Conformité Factur-X EN 16931 implémentée
- Gratuit à faire tourner en dev (Groq/OpenRouter/Supabase free tier)
- RLS Supabase bien configuré
- Rate limiting actif sur tous les endpoints vocaux (10 req/min)
- Support i18n FR/EN complet

### Points bloquants pour la production
1. Régénérer et sécuriser toutes les clés API
2. Créer les assets (icon.png, splash-icon.png…)
3. Remplacer `Math.random()` UUID par `expo-crypto`
4. Implémenter les webhooks Stripe (confirmation paiement)
5. Implémenter la logique d'abonnement Stripe (solo/pro)
6. Ajouter timeouts sur tous les appels `fetch` dans api.ts
