# Recap de session — Factu.me avec Claude

**Date :** 04 avril 2026  
**Projet :** Factu.me — App de facturation vocale (React Native/Expo + Node.js + Supabase)

---

## Architecture du projet

| Dossier | Stack | Rôle |
|---|---|---|
| `factume/` | React Native, Expo SDK 54, expo-router | App mobile |
| `factume-backend/` | Node.js, Express, Groq Whisper, OpenRouter | Backend IA |
| `dictabill-web/` | Next.js | **Hors scope — ne pas toucher** |

---

## Bug critique résolu — IA qui ne fonctionnait plus

### Symptôme
La génération de facture par la voix et le reste des features IA ne fonctionnaient plus.

### Cause racine
Dans `factume-backend/.env`, le modèle OpenRouter n'avait pas le suffixe `:free` :

```env
# AVANT (cassé)
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct

# APRÈS (corrigé)
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

Sans `:free`, OpenRouter tente de facturer la requête au lieu d'utiliser le tier gratuit → rejet.

---

## Questions répondues

### IP locale instable
Deux solutions pour éviter de changer l'IP manuellement à chaque fois :
1. **`hostname.local`** — utilise mDNS (Bonjour) : `http://ton-mac.local:3000`
2. **ngrok** — tunnel public stable : `npx ngrok http 3000` puis copier l'URL HTTPS

### CRM — comment ça fonctionne
- Store Zustand `crmStore` avec `clients[]`
- Données dans Supabase table `clients`
- Écran `app/(app)/(tabs)/clients.tsx` + détail `app/(app)/client/[id].tsx`
- Liaison factures ↔ clients via `client_id` sur la table `invoices`

### E-facturation à 17 ans sans entreprise
- **Factur-X obligatoire qu'à partir de septembre 2027** pour les auto-entrepreneurs
- En attendant, les PDF classiques sont parfaitement légaux
- Pas besoin d'une entreprise pour utiliser ou tester l'app

---

## Fonctionnalités ajoutées

### 1. Templates PDF améliorés (`factume/lib/pdf.ts`)

**Template 1 — Swiss Minimaliste**
- Barre accent fine en haut (3px)
- Numéro de facture géant (36px, font-weight 900)
- TVA affichée en pill badge coloré
- Box total sur fond navy `#1a1a2e` avec montant en couleur accent

**Template 2 — Executive Classique**
- Header bicolore : gauche 55% couleur accent (nom entreprise blanc), droite 45% navy `#1e293b` (numéro doc)
- Lignes de tableau alternées
- Footer total pleine largeur couleur accent

**Template 3 — Luxe Moderne**
- Header full dark `#0B1120` avec grand cercle décoratif flou
- Ligne dégradé accent en bas du header
- Pill badge pour le type de document
- TVA en pill coloré dans chaque ligne
- Card total sombre avec montant 30px

### 2. Dashboard amélioré — `InsightsSection` (`app/(app)/(tabs)/index.tsx`)

Nouveau bloc entre le graphe mensuel et les factures récentes :

- **Taux de recouvrement** : `payé / (payé + en retard) * 100`, barre de progression verte si ≥80%
- **Top 3 clients** : groupé par `client_id`, trié par CA, badges de rang (#1 primary, #2 bleu, #3 violet), barres proportionnelles, cliquables

### 3. Récapitulatif annuel PDF (`lib/pdf.ts` — `generateAndShareAnnualReport`)

Nouveau bouton "Bilan {année}" dans le menu export des factures.

Contenu du PDF :
- KPI cards : CA TTC, CA HT, TVA collectée, Montant en attente
- Graphe en barres mensuel (ASCII/HTML)
- Top 5 clients tableau
- Style premium cohérent avec les templates existants

### 4. Notes vocales sur les clients (`app/(app)/client/[id].tsx`)

Nouvelle carte "Notes" sur la fiche client :
- Bouton micro → enregistre audio (expo-av)
- Arrêt → transcription via `POST /api/transcribe` (Groq Whisper)
- Transcript horodaté ajouté aux notes, sauvegardé en base
- Indicateur d'enregistrement (point rouge animé)
- Zone de texte éditable manuellement avec bouton Sauvegarder

Nouvelle fonction ajoutée dans `lib/api.ts` :
```typescript
export async function transcribeAudio(audioUri: string): Promise<{ transcript: string }>
```

### 5. Filtres avancés sur les factures (`app/(app)/(tabs)/invoices.tsx`)

En plus des filtres existants (statut, type, recherche) :

- **Filtre par client** : bottom sheet modal avec liste des clients
- **Filtre par mois** : chips horizontaux (6 derniers mois)
- **Compteur de filtres actifs** sur le bouton
- **Bouton "Effacer filtres (N)"** dans la barre totale
- Menu export étendu : CSV, FEC, Bilan {année}, Annuler

### 6. Multi-devise (`hooks/useCurrency.ts` — NOUVEAU FICHIER)

```typescript
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';
```

- Taux live via **Frankfurter API** (gratuit, sans clé) : `https://api.frankfurter.app/latest`
- Cache 6 heures dans AsyncStorage (`@facture_rates`)
- Taux de fallback : EUR:1, USD:1.09, GBP:0.86, CHF:0.97
- Fonctions : `convert(amountEur)`, `format(amountEur)`
- Devise sauvegardée dans AsyncStorage (`@facture_currency`)

Sélecteur ajouté dans **Settings** (`app/(app)/(tabs)/settings.tsx`) :
- 4 boutons avec drapeaux (🇪🇺 EUR, 🇺🇸 USD, 🇬🇧 GBP, 🇨🇭 CHF)
- Bouton actif = bordure couleur primaire + fond clair

---

## Fonctionnalités non implémentées (et pourquoi)

### Widget iOS/Android
**Impossible avec Expo managed workflow.**  
Les widgets nécessitent du code natif Swift (iOS) ou Kotlin (Android), et un "App Extension" — non supporté sans éjecter en bare workflow. Ce serait une refonte majeure de l'architecture.

### Acomptes (facture d'acompte liée à un devis)
**Nécessite une migration Supabase** (impossible à exécuter depuis Claude) :

```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_percent numeric(5,2);
ALTER TABLE invoices ALTER COLUMN document_type TYPE text;
-- document_type peut valoir : 'invoice' | 'quote' | 'deposit' | 'credit_note'
-- linked_invoice_id (colonne déjà existante) sert à lier l'acompte au devis parent
```

À faire manuellement dans le dashboard Supabase → SQL Editor.

### Relances automatiques
**Déjà en place dans le backend** : cron quotidien à 9h qui vérifie les factures échues et envoie des rappels J+7 et J+14. Rien à ajouter.

### Export FEC
**Déjà en place côté client** dans `invoices.tsx` via le menu export. Le backend a un endpoint stub `/api/export-fec`.

---

## Prochain step recommandé

Brancher `useCurrency` sur l'affichage des montants partout dans l'app :
- Cards de factures (liste)
- Détail de facture
- Stats du dashboard
- Totaux dans le formulaire de création

Actuellement le hook existe et le sélecteur est dans Settings, mais `format()` n'est pas encore appelé dans ces écrans.

---

## Fichiers modifiés dans cette session

| Fichier | Modification |
|---|---|
| `factume-backend/.env` | Fix `:free` sur OPENROUTER_MODEL |
| `factume/lib/pdf.ts` | Refonte 3 templates + `generateAndShareAnnualReport` |
| `factume/app/(app)/(tabs)/index.tsx` | `InsightsSection` (top clients + recouvrement) |
| `factume/app/(app)/(tabs)/invoices.tsx` | Filtres avancés + export bilan annuel |
| `factume/app/(app)/client/[id].tsx` | Notes vocales + transcription |
| `factume/lib/api.ts` | Ajout `transcribeAudio()` |
| `factume/hooks/useCurrency.ts` | **Nouveau fichier** — hook multi-devise |
| `factume/app/(app)/(tabs)/settings.tsx` | Sélecteur de devise |
