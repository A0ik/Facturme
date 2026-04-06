# Factu.me — Tu parles, on facture.

Application mobile de facturation vocale pour auto-entrepreneurs et indépendants français.

**Domaine :** [factu.me](https://factu.me)

---

## Structure du projet

```
DictaBill-main/
├── factume/          → App mobile (React Native / Expo)
├── factume-backend/  → API backend (Node.js / Express)
└── dictabill-web/      → Site marketing (exclu de ce scope)
```

---

## Architecture complète

### 1. `factume/` — App Mobile (Expo React Native)

```
factume/
├── app/
│   ├── _layout.tsx                    # Root layout (init auth + deep links)
│   ├── index.tsx                      # Router : redirige vers auth ou app
│   ├── (auth)/                        # Stack non authentifié
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx               # Landing + boutons Google/Apple/Email
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding/               # 5 étapes obligatoires
│   │       ├── language.tsx          # Choix langue FR/EN
│   │       ├── company.tsx           # SIRET, nom, adresse (Sirene API)
│   │       ├── template.tsx          # Choix template + couleur accent
│   │       ├── first-client.tsx      # Ajout premier client (optionnel)
│   │       └── done.tsx              # Redirection dashboard
│   └── (app)/                         # Stack authentifié
│       ├── _layout.tsx
│       ├── (tabs)/                    # Navigation par onglets
│       │   ├── _layout.tsx
│       │   ├── index.tsx             # Dashboard (MRR, stats, graphique 6 mois)
│       │   ├── invoices.tsx          # Liste factures + filtres
│       │   ├── clients.tsx           # Répertoire clients + import IA
│       │   └── settings.tsx          # Profil + plans + logo
│       ├── invoice/
│       │   ├── new.tsx               # Création vocal + manuel (modal)
│       │   └── [id].tsx              # Détail + actions (envoyer/payer/dupliquer/Factur-X)
│       ├── client/
│       │   ├── new.tsx               # Création client (modal)
│       │   └── [id].tsx              # Fiche client + historique factures
│       ├── recurring/
│       │   ├── index.tsx             # Liste factures récurrentes
│       │   └── new.tsx               # Création récurrente (modal)
│       └── paywall.tsx               # Upgrade plan (modal)
├── components/
│   ├── VoiceRecorder.tsx             # Enregistreur audio + waveform animé
│   ├── ClientCard.tsx
│   ├── InvoiceCard.tsx               # Swipe-to-delete
│   ├── ErrorBoundary.tsx
│   └── ui/
│       ├── Badge.tsx                 # Statuts (draft/sent/paid/overdue/accepted/refused)
│       ├── Button.tsx                # 5 variantes + loading
│       └── Input.tsx
├── constants/
│   └── Colors.ts                     # Palette + Spacing + Radius + FontSize
├── hooks/
│   └── useSubscription.ts            # Permissions selon plan (free/solo/pro)
├── i18n/
│   ├── index.ts                      # Init i18next + AsyncStorage (@factume_language)
│   ├── fr.ts                         # ~2000 clés FR
│   └── en.ts                         # ~2000 clés EN
├── lib/
│   ├── supabase.ts                   # Client Supabase (AsyncStorage persistence)
│   ├── api.ts                        # Appels backend (voice, email, PDF, stripe...)
│   ├── pdf.ts                        # Génération PDF HTML + Factur-X embed
│   ├── xml.ts                        # Génération XML Factur-X (EN 16931)
│   ├── sirene.ts                     # API Annuaire entreprises (gratuit)
│   └── utils.ts                      # generateId()
├── stores/
│   ├── authStore.ts                  # Auth Zustand (user, profile, OAuth)
│   └── dataStore.ts                  # Data Zustand (clients, invoices, stats)
├── types/
│   └── index.ts                      # Profile, Client, Invoice, RecurringInvoice...
└── supabase/
    ├── schema.sql                    # Schéma complet + RLS + triggers
    └── migrations/
        └── increment_invoice_count.sql  # RPC atomique numérotation
```

**Stack mobile :** Expo 54 · React Native 0.81 · expo-router · Zustand · Supabase · i18next

---

### 2. `factume-backend/` — API Node.js Express

```
factume-backend/
├── server.js              # Tout en 1 fichier (~900 lignes)
├── package.json
└── uploads/               # Fichiers audio temporaires (nettoyés après traitement)
```

**Routes implémentées :**

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/process-voice` | Audio → Whisper → LLM → JSON facture | ✅ JWT |
| POST | `/api/edit-voice-invoice` | Modifier facture existante par la voix | ✅ JWT |
| POST | `/api/transcribe` | Transcription audio seule | ✅ JWT |
| POST | `/api/send-invoice` | Envoi email avec PDF attaché (Nodemailer) | ✅ JWT |
| POST | `/api/import-clients` | Import clients PDF/Excel/CSV/Word via LLM | ✅ JWT |
| POST | `/api/analyze-template` | PDF → Template HTML personnalisé via LLM | ✅ JWT |
| POST | `/api/embed-facturx` | Embarquer XML Factur-X dans PDF (pdf-lib) | ✅ JWT |
| GET  | `/api/stripe/connect/url` | URL OAuth Stripe Connect | ✅ JWT |
| POST | `/api/stripe/connect/callback` | Échange code OAuth Stripe | ✅ JWT |
| POST | `/api/stripe/payment-link` | Créer lien paiement Stripe | ✅ JWT |
| GET  | `/api/health` | Statut backend + services | Public |

**Cron jobs :**
- `08:00` — Génère les factures récurrentes dues + push notification Expo
- `09:00` — Détecte les factures en retard, les passe en `overdue`, envoie un email récapitulatif à chaque utilisateur (si SMTP configuré)

**Stack backend :** Express · Helmet · express-rate-limit · Groq SDK (Whisper) · OpenAI SDK (OpenRouter) · Nodemailer · pdf-lib · xlsx · mammoth · Stripe · node-cron · Supabase

---

## État fonctionnel

### ✅ Production-ready
- Auth email/password + OAuth (Google/Apple)
- Onboarding 5 étapes
- CRUD Clients (avec auto-complétion SIRET)
- CRUD Factures + Devis + Avoirs
- Création vocale (Groq Whisper → OpenRouter LLM)
- Édition vocale d'une facture existante
- PDF generation (2 templates HTML)
- **Factur-X XML** + embedding PDF/A-3b (UN/CEFACT CII EN 16931) — réservé Pro
- Envoi email avec PDF (Nodemailer)
- **Import clients** (PDF/Excel/CSV/Word → LLM) — réservé Solo+
- Factures récurrentes (cron 08:00, push notifications)
- **Rappels automatiques factures en retard** (cron 09:00, email)
- JWT auth middleware sur toutes les routes sensibles
- Rate limiting (100 req/15 min global, 10 req/min vocal)
- Internationalisation FR/EN
- Dashboard stats + graphique 6 mois

### ⚠️ Partiel / Non branché
- **Stripe Connect** : lien paiement créé mais pas de webhook pour marquer la facture payée automatiquement
- **OAuth Google/Apple** : code OK mais nécessite config manuelle dans Supabase dashboard + credentials provider
- **Template 3 (Premium)** : non exposé dans l'UI

### ❌ Non implémenté
- Export CSV/FEC comptable
- WhatsApp (mentionné en Pro, zéro code)
- Dark mode
- Offline mode

---

## Variables d'environnement

### `factume/.env`
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
EXPO_PUBLIC_API_URL=https://api.factu.me
EXPO_PUBLIC_WEB_URL=https://factu.me
```

### `factume-backend/.env`
```env
PORT=3000
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
OPENROUTER_IMPORT_MODEL=google/gemini-2.0-flash-lite
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@factu.me
SMTP_PASS=xxxx xxxx xxxx xxxx
FROM_NAME=Factu.me
STRIPE_SECRET_KEY=sk_live_...
STRIPE_CLIENT_ID=ca_...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
CORS_ORIGIN=https://factu.me
```

---

## Supabase — Configuration

1. Exécuter `factume/supabase/schema.sql` dans l'éditeur SQL
2. Exécuter `factume/supabase/migrations/increment_invoice_count.sql`

Tables : `profiles`, `clients`, `invoices`, `recurring_invoices`

Bucket Storage : `logos` (public, 2 MB max, JPEG/PNG/WebP)

---

## Plans tarifaires

| Fonctionnalité | Free | Solo | Pro |
|---|---|---|---|
| Factures/mois | 3 | Illimitées | Illimitées |
| Import clients IA | ✗ | ✓ | ✓ |
| Factures récurrentes | ✗ | ✓ | ✓ |
| Envoi email | ✗ | ✓ | ✓ |
| Templates perso | ✗ | ✓ | ✓ |
| Stripe paiements | ✗ | ✗ | ✓ |
| Factur-X (EN 16931) | ✗ | ✗ | ✓ |

---

## Deep links

Scheme : `factume://`
- Callback auth OAuth : `factume://auth/callback`
- Stripe Connect retour : `factume://stripe-connect`

---

## Coûts estimés (prod)

| Service | Coût mensuel |
|---------|-------------|
| Supabase Pro | 25$/mois |
| Groq Whisper | Gratuit (7 200 sec/jour) |
| OpenRouter LLM | Gratuit (modèles :free) |
| Backend Railway/Render | ~5-20$/mois |
| Apple Developer | ~8$/mois (99$/an) |
| **Total** | **~40-55$/mois** |

---

*Factu.me v1.0.0 — Conforme e-invoicing France 2026 (Factur-X EN 16931)*
