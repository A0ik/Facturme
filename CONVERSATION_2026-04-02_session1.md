# Session de travail — Factu.me · 02 avril 2026 (session 1)

---

## Contexte de départ

Suite de la session 2 du 01/04. Cette session couvre : audit de conformité Factur-X pour la réforme e-invoicing 2026, corrections XML, et implémentation TVA franchise + BT-48.

---

## 1. Audit conformité Factur-X

### Constat initial (sans lire le code)
Analyse erronée : plusieurs champs signalés comme manquants alors qu'ils étaient déjà implémentés.

### Vrai état après lecture de `factume/lib/xml.ts`

| BT | Champ | État réel |
|----|-------|-----------|
| BT-23 | Business process type | ❌ manquant |
| BT-24 | Specification ID (`urn:factur-x.eu:1p0:en16931`) | ✅ déjà là |
| BT-29/30 | SIRET vendeur | ✅ déjà là |
| BT-31 | TVA vendeur | ✅ déjà là |
| BT-34 | Email vendeur | ✅ déjà là |
| BT-46 | SIRET acheteur | ✅ déjà là |
| BT-49 | Email acheteur | ✅ déjà là |
| BT-81 | PaymentMeansCode | ✅ déjà là |

---

## 2. Ajout BT-23

**Fichier** : `factume/lib/xml.ts`

Ajout de `BusinessProcessSpecifiedDocumentContextParameter` dans `ExchangedDocumentContext` :

```xml
<ram:BusinessProcessSpecifiedDocumentContextParameter>
  <ram:ID>A1</ram:ID>
</ram:BusinessProcessSpecifiedDocumentContextParameter>
```

`A1` = transaction commerciale standard (valeur recommandée EN 16931).

---

## 3. Ce qui reste non conforme (et pourquoi)

### Routage B2B PPF/PDP
La réforme impose que les factures B2B transitent via le PPF (DGFIP) ou une PDP agréée.
- Le code génère un fichier valide, mais ne le route pas
- L'API PPF B2B n'est pas encore ouverte publiquement
- Les PDP nécessitent des contrats commerciaux
- **Non implémentable sans démarches externes**

### Validation schematron officielle
- Requiert Saxon (Java / XSLT 2.0)
- Aucune lib Node.js viable
- **Non implémentable raisonnablement**

### PDF/A-3b
- Déjà implémenté via Ghostscript (session 2)
- Conditionnel : certifié uniquement si Ghostscript installé sur le serveur de prod

---

## 4. Implémentation TVA franchise + BT-48

### Problème
- Majorité des utilisateurs Factu.me = auto-entrepreneurs en **franchise en base de TVA** (art. 293 B du CGI)
- Le XML utilisait `CategoryCode = S` pour toutes les lignes → incorrect pour ces utilisateurs
- `client.vat_number` existait dans le type `Client` mais n'apparaissait pas dans le XML

### Détection franchise TVA

```ts
const isFranchiseTva = !profile.vat_number;
```

Si le profil vendeur n'a pas de numéro TVA → franchise.

### Modifications dans `factume/lib/xml.ts`

**Résumé TVA (header)** — quand `isFranchiseTva` :
```xml
<ram:ApplicableTradeTax>
  <ram:CalculatedAmount currencyID="EUR">0.00</ram:CalculatedAmount>
  <ram:TypeCode>VAT</ram:TypeCode>
  <ram:ExemptionReasonCode>AAM</ram:ExemptionReasonCode>
  <ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>
  <ram:BasisAmount currencyID="EUR">...</ram:BasisAmount>
  <ram:CategoryCode>E</ram:CategoryCode>
  <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>
</ram:ApplicableTradeTax>
```

**Lignes de facturation** — quand `isFranchiseTva` :
```xml
<ram:ApplicableTradeTax>
  <ram:TypeCode>VAT</ram:TypeCode>
  <ram:ExemptionReasonCode>AAM</ram:ExemptionReasonCode>
  <ram:CategoryCode>E</ram:CategoryCode>
  <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>
</ram:ApplicableTradeTax>
```

**BT-48 (TVA acheteur)** — ajouté dans `BuyerTradeParty` :
```xml
${clientVat ? `<ram:SpecifiedTaxRegistration>
  <ram:ID schemeID="VA">${clientVat}</ram:ID>
</ram:SpecifiedTaxRegistration>` : ''}
```

---

## 5. Architecture des fichiers modifiés

```
factume/
└── lib/
    └── xml.ts
        ├── BT-23 : BusinessProcessSpecifiedDocumentContextParameter (A1)
        ├── isFranchiseTva : détection franchise TVA via !profile.vat_number
        ├── vatSummaryLines : CategoryCode E + ExemptionReason si franchise
        ├── lineItems : CategoryCode E par ligne si franchise
        └── BuyerTradeParty : BT-48 clientVat ajouté
```

---

## 6. État conformité final

| Aspect | État |
|--------|------|
| Format XML EN 16931 | ✅ conforme |
| BT-23 Business process | ✅ ajouté (A1) |
| TVA franchise art. 293 B | ✅ géré (CategoryCode E) |
| BT-48 TVA acheteur | ✅ ajouté |
| PDF/A-3b | ✅ si Ghostscript sur prod |
| Routage B2B PPF/PDP | ❌ hors scope (pas d'API ouverte) |
| Validation schematron | ❌ hors scope (Saxon requis) |

---

## 7. Contexte réglementaire (rappel)

| Obligation | Date | Qui |
|-----------|------|-----|
| Recevoir e-factures | Sept 2026 | Grandes entreprises |
| Émettre | Sept 2027 | ETI + PME |
| Émettre | 2027-2028 | **Micro ← utilisateurs Factu.me** |

Les utilisateurs Factu.me (micro/auto-entrepreneurs) ont jusqu'à **2027-2028** pour émettre des e-factures. Le routage PPF/PDP peut être implémenté quand l'API DGFIP sera ouverte.

---

## 8. Prochaines priorités

1. **Stripe webhook** — marquer facture `paid` quand paiement reçu (priorité 1, trou fonctionnel depuis session 1)
2. **Ghostscript** — installer sur serveur de prod pour PDF/A-3b certifié
3. **Chorus Pro** — configurer identifiants PISTE (variables `.env`)
4. **deleteAccount()** — suppression compte utilisateur (appel admin Supabase côté backend)
5. **Routage PPF/PDP** — à implémenter quand l'API DGFIP B2B sera disponible
