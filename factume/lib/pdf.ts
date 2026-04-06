import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Invoice, Profile } from '../types';
import { generateFacturXml } from './xml';
import { embedFacturX } from './api';

// ─── Formatage ───────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ─── Label selon type de document ────────────────────────────────────────────
export function getDocLabel(invoice: Invoice, language: string = 'fr'): string {
  const labels: Record<string, Record<string, string>> = {
    fr: { invoice: 'FACTURE', quote: 'DEVIS', credit_note: 'AVOIR' },
    en: { invoice: 'INVOICE', quote: 'QUOTE', credit_note: 'CREDIT NOTE' },
  };
  return (labels[language] || labels['fr'])[invoice.document_type || 'invoice'] || 'FACTURE';
}

// ─── Labels contextuels selon type ───────────────────────────────────────────
interface DocLabels {
  issuedLabel: string;
  dueDateSection: string;
  billedToLabel: string;
  totalLabel: string;
  showSignatureBlock: boolean;
}

function getDocLabels(invoice: Invoice): DocLabels {
  switch (invoice.document_type) {
    case 'quote':
      return {
        issuedLabel: 'Établi le',
        dueDateSection: invoice.due_date
          ? `Valable jusqu'au ${formatDate(invoice.due_date)}`
          : 'Valable 30 jours',
        billedToLabel: 'Adressé à',
        totalLabel: "Montant de l'offre TTC",
        showSignatureBlock: true,
      };
    case 'credit_note':
      return {
        issuedLabel: 'Émis le',
        dueDateSection: '',
        billedToLabel: 'Crédité à',
        totalLabel: 'Montant du crédit TTC',
        showSignatureBlock: false,
      };
    default:
      return {
        issuedLabel: 'Émise le',
        dueDateSection: invoice.due_date
          ? `Échéance : ${formatDate(invoice.due_date)}`
          : '',
        billedToLabel: 'Facturé à',
        totalLabel: 'Total TTC',
        showSignatureBlock: false,
      };
  }
}

// ─── Bloc "Bon pour accord" (devis uniquement) — SIGNATURE SAFE ───────────────
// N'affiche le bloc que si la signature est valide ; masque l'image si cassée
function signatureBlockHtml(accentColor: string, signatureUrl?: string): string {
  const hasSignature = signatureUrl && signatureUrl.startsWith('http');

  const signatureSection = hasSignature
    ? `<div style="margin-bottom:6px;font-size:11px;color:#6b7280">Signature et cachet :</div>
       <img src="${signatureUrl}" alt="Signature"
         style="height:64px;max-width:200px;object-fit:contain;display:block"
         onerror="this.parentNode.style.display='none'"/>`
    : `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">Signature et cachet :</div>
       <div style="height:56px;border:1px dashed #d1d5db;border-radius:6px;background:#fff"></div>`;

  return `
<div style="margin-top:28px;border:1.5px dashed ${accentColor}66;border-radius:10px;padding:20px 24px;background:#fafafa">
  <div style="font-size:10px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px">✎ Bon pour accord</div>
  <div style="display:flex;gap:24px;align-items:flex-end">
    <div style="flex:1">
      <div style="font-size:11px;color:#6b7280;margin-bottom:22px">Date :</div>
      <div style="height:1px;background:#d1d5db"></div>
    </div>
    <div style="flex:2">${signatureSection}</div>
  </div>
</div>`;
}

// ─── Données communes ─────────────────────────────────────────────────────────
function buildInvoiceData(invoice: Invoice, profile: Profile) {
  const accentColor = profile.accent_color || '#1D9E75';
  const clientName = invoice.client?.name || invoice.client_name_override || 'Client non défini';
  const clientAddress = invoice.client
    ? [
        invoice.client.address,
        invoice.client.postal_code && invoice.client.city
          ? `${invoice.client.postal_code} ${invoice.client.city}`
          : invoice.client.city,
        invoice.client.country !== 'France' ? invoice.client.country : null,
      ].filter(Boolean).join('<br/>')
    : '';
  const legalMentions = getLegalMention(profile.legal_status, profile.siret, invoice.document_type);
  return { accentColor, clientName, clientAddress, legalMentions };
}

// ─── Template 1 : Minimaliste Swiss ──────────────────────────────────────────
function templateMinimaliste(invoice: Invoice, profile: Profile): string {
  const { accentColor, clientName, clientAddress, legalMentions } = buildInvoiceData(invoice, profile);
  const labels = getDocLabels(invoice);
  const logoHtml = profile.logo_url
    ? `<img src="${profile.logo_url}" alt="Logo" style="height:56px;max-width:180px;object-fit:contain;display:block;margin-bottom:16px" onerror="this.style.display='none'"/>`
    : '';

  const itemsHtml = invoice.items.map((item, i) => `
    <tr>
      <td style="padding:14px 16px;color:#1a1a2e;font-size:13px;border-bottom:1px solid #f0f0f5;line-height:1.5">${item.description}</td>
      <td style="padding:14px 10px;text-align:center;color:#6b7280;font-size:13px;border-bottom:1px solid #f0f0f5">${item.quantity}</td>
      <td style="padding:14px 10px;text-align:right;color:#374151;font-size:13px;border-bottom:1px solid #f0f0f5">${formatCurrency(item.unit_price)}</td>
      <td style="padding:14px 10px;text-align:center;border-bottom:1px solid #f0f0f5">
        <span style="background:${accentColor}15;color:${accentColor};font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">${item.vat_rate}%</span>
      </td>
      <td style="padding:14px 16px;text-align:right;font-weight:700;color:#1a1a2e;font-size:13px;border-bottom:1px solid #f0f0f5">${formatCurrency(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a2e; background:#fff; padding:0 }
  @page { margin: 0; size: A4 }
</style>
</head><body>

<!-- BARRE TOP ACCENT -->
<div style="height:3px;background:${accentColor}"></div>

<div style="padding:52px 60px">

<!-- EN-TÊTE -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:52px">
  <div style="max-width:55%">
    ${logoHtml}
    <div style="font-size:24px;font-weight:800;color:#1a1a2e;letter-spacing:-0.5px;line-height:1.1;margin-bottom:10px">${profile.company_name || 'Votre Entreprise'}</div>
    <div style="font-size:12px;color:#6b7280;line-height:2;margin-top:4px">
      ${profile.address ? `<span>${profile.address}</span><br/>` : ''}
      ${profile.postal_code && profile.city ? `<span>${profile.postal_code} ${profile.city}</span><br/>` : ''}
      ${profile.phone ? `<span>${profile.phone}</span><br/>` : ''}
      ${profile.siret ? `<span style="color:#9ca3af;font-size:11px">SIRET ${profile.siret}</span>` : ''}
      ${profile.vat_number ? `<br/><span style="color:#9ca3af;font-size:11px">N° TVA ${profile.vat_number}</span>` : ''}
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:3px;margin-bottom:10px">${getDocLabel(invoice, profile.language || 'fr')}</div>
    <div style="font-size:36px;font-weight:900;color:#1a1a2e;letter-spacing:-1.5px;line-height:1;margin-bottom:14px">${invoice.number}</div>
    <div style="font-size:12px;color:#6b7280;line-height:2">
      <div>${labels.issuedLabel} <strong style="color:#374151">${formatDate(invoice.issue_date)}</strong></div>
      ${labels.dueDateSection ? `<div style="color:${accentColor};font-weight:600">${labels.dueDateSection}</div>` : ''}
    </div>
  </div>
</div>

<!-- LIGNE FINE -->
<div style="height:1px;background:#e8e8f0;margin-bottom:40px"></div>

<!-- PARTIES -->
<div style="display:flex;gap:24px;margin-bottom:44px">
  <div style="flex:1;padding:22px 24px;background:#f8f8fc;border-radius:12px">
    <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px">De</div>
    <div style="font-weight:700;color:#1a1a2e;font-size:14px;margin-bottom:6px">${profile.company_name || ''}</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.8">
      ${profile.address || ''}<br/>
      ${profile.postal_code && profile.city ? profile.postal_code + ' ' + profile.city : ''}
    </div>
  </div>
  <div style="flex:1;padding:22px 24px;background:#fff;border-radius:12px;border:1.5px solid ${accentColor}30;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${accentColor};border-radius:12px 0 0 12px"></div>
    <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px">${labels.billedToLabel}</div>
    <div style="font-weight:700;color:#1a1a2e;font-size:14px;margin-bottom:6px">${clientName}</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.8">
      ${clientAddress}
      ${invoice.client?.email ? `<br/>${invoice.client.email}` : ''}
      ${invoice.client?.siret ? `<br/><span style="color:#9ca3af;font-size:11px">SIRET ${invoice.client.siret}</span>` : ''}
      ${invoice.client?.vat_number ? `<br/><span style="color:#9ca3af;font-size:11px">N° TVA ${invoice.client.vat_number}</span>` : ''}
    </div>
  </div>
</div>

<!-- TABLEAU PRESTATIONS -->
<table style="width:100%;border-collapse:collapse;margin-bottom:32px">
  <thead>
    <tr style="border-bottom:2px solid #1a1a2e">
      <th style="padding:10px 16px;font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;text-align:left">Prestation</th>
      <th style="padding:10px 10px;font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;text-align:center">Qté</th>
      <th style="padding:10px 10px;font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;text-align:right">P.U. HT</th>
      <th style="padding:10px 10px;font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;text-align:center">TVA</th>
      <th style="padding:10px 16px;font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;text-align:right">Total HT</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

<!-- TOTAUX -->
<div style="display:flex;justify-content:flex-end;margin-bottom:40px">
  <div style="width:300px">
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:12px;color:#6b7280"><span>Sous-total HT</span><span style="color:#374151">${formatCurrency(invoice.subtotal)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:12px;color:#6b7280;border-bottom:1px solid #e8e8f0;margin-bottom:12px"><span>TVA</span><span style="color:#374151">${formatCurrency(invoice.vat_amount)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-radius:12px;background:#1a1a2e">
      <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px">${labels.totalLabel}</span>
      <span style="font-size:26px;font-weight:900;color:${accentColor};letter-spacing:-0.5px">${formatCurrency(invoice.total)}</span>
    </div>
  </div>
</div>

${invoice.notes ? `
<div style="margin-bottom:32px;padding:18px 22px;background:#f8f8fc;border-radius:10px;border-left:3px solid ${accentColor}">
  <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Notes</div>
  <div style="font-size:12px;color:#374151;line-height:1.8">${invoice.notes}</div>
</div>` : ''}
${invoice.payment_link ? stripePaymentButtonHtml(invoice.payment_link, invoice.total) : ''}
${labels.showSignatureBlock ? signatureBlockHtml(accentColor, profile.signature_url) : ''}

<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e8e8f0;font-size:10px;color:#b0b0c0;text-align:center;line-height:2">${legalMentions}</div>
</div>
</body></html>`;
}

// ─── Template 2 : Classique Executive ────────────────────────────────────────
function templateClassique(invoice: Invoice, profile: Profile): string {
  const { accentColor, clientName, clientAddress, legalMentions } = buildInvoiceData(invoice, profile);
  const labels = getDocLabels(invoice);
  const logoHtml = profile.logo_url
    ? `<img src="${profile.logo_url}" alt="Logo" style="height:56px;max-width:180px;object-fit:contain;display:block" onerror="this.style.display='none'"/>`
    : '';

  const itemsHtml = invoice.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafbff'}">
      <td style="padding:14px 18px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;line-height:1.5">${item.description}</td>
      <td style="padding:14px 10px;text-align:center;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0">${item.quantity}</td>
      <td style="padding:14px 10px;text-align:right;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0">${formatCurrency(item.unit_price)}</td>
      <td style="padding:14px 10px;text-align:center;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0">${item.vat_rate}%</td>
      <td style="padding:14px 18px;text-align:right;font-weight:700;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0">${formatCurrency(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; color:#1e293b; background:#fff }
  @page { margin: 0; size: A4 }
</style>
</head><body>

<!-- HEADER BICOLORE -->
<div style="display:flex;height:140px">
  <!-- Colonne gauche : logo + nom -->
  <div style="flex:1.2;background:${accentColor};padding:32px 36px;display:flex;flex-direction:column;justify-content:center">
    ${logoHtml ? `<div style="margin-bottom:10px">${logoHtml}</div>` : ''}
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;line-height:1.1">${profile.company_name || 'Votre Entreprise'}</div>
    ${profile.siret ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:0.3px">SIRET ${profile.siret}</div>` : ''}
  </div>
  <!-- Colonne droite : numéro doc -->
  <div style="flex:1;background:#1e293b;padding:32px 36px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end">
    <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">${getDocLabel(invoice, profile.language || 'fr')}</div>
    <div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1">${invoice.number}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;line-height:1.9;text-align:right">
      <div>${labels.issuedLabel} ${formatDate(invoice.issue_date)}</div>
      ${labels.dueDateSection ? `<div style="color:${accentColor};font-weight:600">${labels.dueDateSection}</div>` : ''}
    </div>
  </div>
</div>

<!-- CORPS -->
<div style="padding:44px 52px">

  <!-- PARTIES -->
  <div style="display:flex;gap:24px;margin-bottom:44px">
    <div style="flex:1;padding:20px 24px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
      <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px">Émetteur</div>
      <div style="font-weight:700;color:#1e293b;font-size:14px;margin-bottom:6px">${profile.company_name || ''}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.9">
        ${profile.address ? `${profile.address}<br/>` : ''}
        ${profile.postal_code && profile.city ? `${profile.postal_code} ${profile.city}<br/>` : ''}
        ${profile.phone ? `${profile.phone}<br/>` : ''}
        ${profile.vat_number ? `<span style="color:#94a3b8;font-size:11px">TVA ${profile.vat_number}</span>` : ''}
      </div>
    </div>
    <div style="flex:1;padding:20px 24px;background:#fff;border-radius:10px;border:2px solid ${accentColor}20">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2.5px">${labels.billedToLabel}</div>
      </div>
      <div style="font-weight:700;color:#1e293b;font-size:14px;margin-bottom:6px">${clientName}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.9">
        ${clientAddress}
        ${invoice.client?.email ? `<br/>${invoice.client.email}` : ''}
        ${invoice.client?.siret ? `<br/><span style="color:#94a3b8;font-size:11px">SIRET ${invoice.client.siret}</span>` : ''}
        ${invoice.client?.vat_number ? `<br/><span style="color:#94a3b8;font-size:11px">TVA ${invoice.client.vat_number}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- TABLEAU -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
    <thead>
      <tr style="background:#f1f5f9;border-bottom:2px solid ${accentColor}">
        <th style="padding:12px 18px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:left">Désignation</th>
        <th style="padding:12px 10px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:center">Qté</th>
        <th style="padding:12px 10px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:right">P.U. HT</th>
        <th style="padding:12px 10px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:center">TVA</th>
        <th style="padding:12px 18px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:right">Montant HT</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <!-- TOTAUX -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
    <div style="width:310px">
      <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:12px;color:#64748b;background:#f8fafc;border-radius:8px 8px 0 0"><span>Sous-total HT</span><span style="color:#1e293b">${formatCurrency(invoice.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:12px;color:#64748b;background:#f8fafc;border-top:1px solid #e2e8f0"><span>TVA</span><span style="color:#1e293b">${formatCurrency(invoice.vat_amount)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;background:${accentColor};border-radius:0 0 8px 8px">
        <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:0.5px">${labels.totalLabel}</span>
        <span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px">${formatCurrency(invoice.total)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div style="margin-bottom:32px;padding:18px 22px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;border-left:4px solid ${accentColor}">
    <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Notes &amp; conditions</div>
    <div style="font-size:12px;color:#475569;line-height:1.8">${invoice.notes}</div>
  </div>` : ''}
  ${invoice.payment_link ? stripePaymentButtonHtml(invoice.payment_link, invoice.total) : ''}
  ${labels.showSignatureBlock ? signatureBlockHtml(accentColor, profile.signature_url) : ''}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;line-height:2">${legalMentions}</div>
</div>
</body></html>`;
}

// ─── Template 3 : Moderne Luxe ───────────────────────────────────────────────
function templateModerne(invoice: Invoice, profile: Profile): string {
  const { accentColor, clientName, clientAddress, legalMentions } = buildInvoiceData(invoice, profile);
  const labels = getDocLabels(invoice);
  const darkBg = '#0B1120';
  const logoHtml = profile.logo_url
    ? `<img src="${profile.logo_url}" alt="Logo" style="height:48px;max-width:160px;object-fit:contain;display:block;margin-bottom:14px;filter:brightness(0) invert(1)" onerror="this.style.display='none'"/>`
    : '';

  const itemsHtml = invoice.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafe'}">
      <td style="padding:15px 18px;color:#0f172a;font-size:13px;border-bottom:1px solid #eef0f8;line-height:1.5">${item.description}</td>
      <td style="padding:15px 10px;text-align:center;color:#64748b;font-size:13px;border-bottom:1px solid #eef0f8">${item.quantity}</td>
      <td style="padding:15px 10px;text-align:right;color:#475569;font-size:13px;border-bottom:1px solid #eef0f8">${formatCurrency(item.unit_price)}</td>
      <td style="padding:15px 10px;text-align:center;border-bottom:1px solid #eef0f8">
        <span style="background:${accentColor}18;color:${accentColor};font-weight:700;font-size:11px;padding:3px 9px;border-radius:20px">${item.vat_rate}%</span>
      </td>
      <td style="padding:15px 18px;text-align:right;font-weight:800;color:#0f172a;font-size:13px;border-bottom:1px solid #eef0f8">${formatCurrency(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; color:#0f172a; background:#fff }
  @page { margin: 0; size: A4 }
</style>
</head><body>

<!-- HEADER DARK LUXE -->
<div style="background:${darkBg};padding:48px 56px 52px;position:relative;overflow:hidden;min-height:170px">
  <!-- Déco : grand cercle flou accent -->
  <div style="position:absolute;top:-80px;right:-80px;width:320px;height:320px;border-radius:50%;background:${accentColor};opacity:0.12;filter:blur(2px)"></div>
  <!-- Déco : petit cercle en bas à gauche -->
  <div style="position:absolute;bottom:-50px;left:30%;width:180px;height:180px;border-radius:50%;background:${accentColor};opacity:0.05"></div>
  <!-- Ligne accent fine en bas du header -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(to right,${accentColor},transparent)"></div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:2">
    <div>
      ${logoHtml}
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;margin-bottom:10px">${profile.company_name || 'Votre Entreprise'}</div>
      <div style="font-size:11.5px;color:rgba(255,255,255,0.45);line-height:2">
        ${profile.address ? `${profile.address}<br/>` : ''}
        ${profile.postal_code && profile.city ? `${profile.postal_code} ${profile.city}` : ''}
        ${profile.phone ? ` &nbsp;·&nbsp; ${profile.phone}` : ''}
        ${profile.siret ? `<br/><span style="font-size:10px">SIRET ${profile.siret}</span>` : ''}
        ${profile.vat_number ? `<br/><span style="font-size:10px">TVA ${profile.vat_number}</span>` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="display:inline-flex;align-items:center;gap:6px;background:${accentColor};padding:6px 18px;border-radius:24px;margin-bottom:14px">
        <span style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:2px">${getDocLabel(invoice, profile.language || 'fr')}</span>
      </div>
      <div style="font-size:34px;font-weight:900;color:#fff;letter-spacing:-1.5px;line-height:1;margin-bottom:12px">${invoice.number}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.45);line-height:2.1;text-align:right">
        <div>${labels.issuedLabel} ${formatDate(invoice.issue_date)}</div>
        ${labels.dueDateSection ? `<div style="color:${accentColor};font-weight:700">${labels.dueDateSection}</div>` : ''}
      </div>
    </div>
  </div>
</div>

<!-- CORPS BLANC -->
<div style="background:#fff;padding:44px 56px">

  <!-- PARTIES -->
  <div style="display:flex;gap:20px;margin-bottom:44px">
    <div style="flex:1;padding:22px 24px;background:#f9fafe;border-radius:14px;border:1px solid #eef0f8">
      <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px">Émetteur</div>
      <div style="font-weight:800;color:#0b1120;font-size:15px;margin-bottom:6px">${profile.company_name || ''}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.9">
        ${profile.address ? `${profile.address}<br/>` : ''}
        ${profile.postal_code && profile.city ? `${profile.postal_code} ${profile.city}` : ''}
      </div>
    </div>
    <div style="flex:1;padding:22px 24px;background:#fff;border-radius:14px;border:1.5px solid ${accentColor}30;position:relative;overflow:hidden">
      <!-- Accent strip -->
      <div style="position:absolute;top:0;left:0;bottom:0;width:4px;background:${accentColor};border-radius:14px 0 0 14px"></div>
      <div style="padding-left:8px">
        <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px">${labels.billedToLabel}</div>
        <div style="font-weight:800;color:#0b1120;font-size:15px;margin-bottom:6px">${clientName}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.9">
          ${clientAddress}
          ${invoice.client?.email ? `<br/>${invoice.client.email}` : ''}
          ${invoice.client?.siret ? `<br/><span style="font-size:10px;color:#94a3b8">SIRET ${invoice.client.siret}</span>` : ''}
          ${invoice.client?.vat_number ? `<br/><span style="font-size:10px;color:#94a3b8">TVA ${invoice.client.vat_number}</span>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- TABLEAU PRESTATIONS -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;border-radius:12px;overflow:hidden;border:1.5px solid #eef0f8">
    <thead>
      <tr style="background:${darkBg}">
        <th style="padding:13px 18px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;text-align:left">Prestation</th>
        <th style="padding:13px 10px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;text-align:center">Qté</th>
        <th style="padding:13px 10px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;text-align:right">P.U. HT</th>
        <th style="padding:13px 10px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;text-align:center">TVA</th>
        <th style="padding:13px 18px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;text-align:right">Total HT</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <!-- TOTAUX -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
    <div style="width:320px;background:#f9fafe;border-radius:14px;overflow:hidden;border:1px solid #eef0f8">
      <div style="display:flex;justify-content:space-between;padding:12px 20px;font-size:12px;color:#64748b;border-bottom:1px solid #eef0f8">
        <span>Sous-total HT</span><span style="color:#0f172a;font-weight:600">${formatCurrency(invoice.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 20px;font-size:12px;color:#64748b;">
        <span>TVA</span><span style="color:#0f172a;font-weight:600">${formatCurrency(invoice.vat_amount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;background:${darkBg}">
        <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px">${labels.totalLabel}</span>
        <span style="font-size:30px;font-weight:900;color:${accentColor};letter-spacing:-1px">${formatCurrency(invoice.total)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div style="margin-bottom:32px;padding:18px 24px;border-radius:12px;background:#f9fafe;border:1.5px solid ${accentColor}25">
    <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Notes</div>
    <div style="font-size:12px;color:#475569;line-height:1.9">${invoice.notes}</div>
  </div>` : ''}
  ${invoice.payment_link ? stripePaymentButtonHtml(invoice.payment_link, invoice.total) : ''}
  ${labels.showSignatureBlock ? signatureBlockHtml(accentColor, profile.signature_url) : ''}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #eef0f8;font-size:10px;color:#94a3b8;text-align:center;line-height:2">${legalMentions}</div>
</div>
</body></html>`;
}

// ─── Template 4 : Custom (généré par IA depuis PDF uploadé) ──────────────────
function injectCustomTemplate(html: string, invoice: Invoice, profile: Profile): string {
  const { clientName, clientAddress, legalMentions } = buildInvoiceData(invoice, profile);

  const companyAddress = [
    profile.address,
    profile.postal_code && profile.city ? `${profile.postal_code} ${profile.city}` : profile.city,
    profile.phone,
  ].filter(Boolean).join(', ');

  const itemsTableHtml = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr>
        <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;font-size:12px">Description</th>
        <th style="padding:8px;text-align:center;border-bottom:2px solid #ddd;font-size:12px">Qté</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd;font-size:12px">P.U. HT</th>
        <th style="padding:8px;text-align:center;border-bottom:2px solid #ddd;font-size:12px">TVA</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd;font-size:12px">Total HT</th>
      </tr></thead>
      <tbody>
        ${invoice.items.map((item) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${item.description}</td>
          <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;font-size:12px">${item.quantity}</td>
          <td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font-size:12px">${formatCurrency(item.unit_price)}</td>
          <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;font-size:12px">${item.vat_rate}%</td>
          <td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font-size:12px;font-weight:600">${formatCurrency(item.total)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  return html
    .replace(/\{\{DOCUMENT_TYPE\}\}/g, getDocLabel(invoice, profile.language || 'fr'))
    .replace(/\{\{COMPANY_NAME\}\}/g, profile.company_name || '')
    .replace(/\{\{COMPANY_ADDRESS\}\}/g, companyAddress)
    .replace(/\{\{SIRET\}\}/g, profile.siret || '')
    .replace(/\{\{INVOICE_NUMBER\}\}/g, invoice.number)
    .replace(/\{\{INVOICE_DATE\}\}/g, formatDate(invoice.issue_date))
    .replace(/\{\{DUE_DATE\}\}/g, invoice.due_date ? formatDate(invoice.due_date) : '')
    .replace(/\{\{CLIENT_NAME\}\}/g, clientName)
    .replace(/\{\{CLIENT_ADDRESS\}\}/g, clientAddress)
    .replace(/\{\{ITEMS_TABLE\}\}/g, itemsTableHtml)
    .replace(/\{\{SUBTOTAL\}\}/g, formatCurrency(invoice.subtotal))
    .replace(/\{\{VAT_AMOUNT\}\}/g, formatCurrency(invoice.vat_amount))
    .replace(/\{\{TOTAL\}\}/g, formatCurrency(invoice.total))
    .replace(/\{\{NOTES\}\}/g, invoice.notes || '')
    .replace(/\{\{LEGAL_MENTIONS\}\}/g, legalMentions);
}

// ─── Bouton paiement Stripe (Pro) ─────────────────────────────────────────────
function stripePaymentButtonHtml(paymentLink: string, total: number): string {
  return `
<div style="text-align:center;margin:28px 0 16px">
  <a href="${paymentLink}" style="background:#635BFF;color:#fff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;display:inline-block;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(99,91,255,0.4)">
    💳 Payer maintenant — ${formatCurrency(total)}
  </a>
  <div style="font-size:10px;color:#9ca3af;margin-top:8px">Paiement sécurisé via Stripe</div>
</div>`;
}

// ─── Watermark plan gratuit ───────────────────────────────────────────────────
function addFreeWatermark(html: string): string {
  const watermark = `
<div style="position:fixed;bottom:24px;right:24px;background:rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.1);border-radius:8px;padding:6px 12px;font-size:10px;color:#999;font-family:Arial,sans-serif;z-index:9999">
  Généré avec <strong style="color:#1D9E75">Factu.me</strong> — Plan Gratuit
</div>`;
  return html.replace('</body>', watermark + '</body>');
}

// ─── Résolution image (file:// ou https:// → base64 data URI) ────────────────
async function resolveImageUri(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined;
  if (uri.startsWith('data:')) return uri;
  try {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // Téléchargement vers un fichier temporaire puis lecture en base64
      const tempPath = `${FileSystem.cacheDirectory}imgcache_${Date.now()}.tmp`;
      const result = await FileSystem.downloadAsync(uri, tempPath);
      if (result.status === 200) {
        const base64 = await FileSystem.readAsStringAsync(tempPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        const ct = (result.headers as Record<string, string>)?.['content-type'] || '';
        const mime = ct.includes('png') ? 'image/png'
          : ct.includes('gif') ? 'image/gif'
          : ct.includes('webp') ? 'image/webp'
          : 'image/jpeg';
        return `data:${mime};base64,${base64}`;
      }
      return uri;
    }
    // URI locale (file://)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const mime = ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return uri;
  }
}

// ─── Routeur de templates ─────────────────────────────────────────────────────
export async function generateInvoiceHtml(invoice: Invoice, profile: Profile): Promise<string> {
  const [resolvedLogoUrl, resolvedSignatureUrl] = await Promise.all([
    resolveImageUri(profile.logo_url),
    resolveImageUri(profile.signature_url),
  ]);
  const p = {
    ...profile,
    ...(resolvedLogoUrl ? { logo_url: resolvedLogoUrl } : {}),
    ...(resolvedSignatureUrl ? { signature_url: resolvedSignatureUrl } : {}),
  };

  let html: string;
  if (p.template_id === 4 && p.custom_template_html) {
    html = injectCustomTemplate(p.custom_template_html, invoice, p);
  } else {
    switch (p.template_id) {
      case 2: html = templateClassique(invoice, p); break;
      case 3: html = templateModerne(invoice, p); break;
      default: html = templateMinimaliste(invoice, p); break;
    }
  }
  if (p.subscription_tier === 'free') {
    html = addFreeWatermark(html);
  }
  return html;
}

// ─── Mentions légales selon statut et type de document ───────────────────────
function getLegalMention(legalStatus: string, siret?: string, documentType?: string): string {
  const siretMention = siret ? ` • SIRET ${siret}` : '';
  const base = `Document généré par Factu.me${siretMention}`;

  if (documentType === 'quote') {
    return `${base} • Devis valable 30 jours à compter de sa date d'émission. Pour acceptation, retourner signé avec la mention "Bon pour accord". Conditions générales de vente disponibles sur demande.`;
  }
  if (documentType === 'credit_note') {
    return `${base} • Avoir émis en annulation ou correction partielle d'une facture précédente. Ce document vaut crédit auprès de notre établissement.`;
  }

  switch (legalStatus) {
    case 'auto-entrepreneur':
      return `${base} • Auto-entrepreneur • TVA non applicable, article 293 B du CGI • Pénalités de retard : 3x le taux légal • Pas d'escompte pour paiement anticipé`;
    case 'eurl':
    case 'sarl':
      return `${base} • En cas de retard de paiement, pénalités au taux BCE + 10 points • Indemnité forfaitaire pour frais de recouvrement : 40€`;
    default:
      return `${base} • En cas de retard de paiement, pénalités au taux légal en vigueur`;
  }
}

// ─── Génération et partage du PDF ────────────────────────────────────────────
export async function generateAndSharePdf(invoice: Invoice, profile: Profile): Promise<string> {
  const html = await generateInvoiceHtml(invoice, profile);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const pdfPath = `${FileSystem.documentDirectory}${invoice.number}.pdf`;
  await FileSystem.moveAsync({ from: uri, to: pdfPath });

  return pdfPath;
}

export async function sharePdf(pdfUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Le partage n'est pas disponible sur cet appareil");
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Partager le document',
  });
}

// ─── Génération du PDF en base64 (pour email) ────────────────────────────────
export async function generatePdfBase64(invoice: Invoice, profile: Profile): Promise<string> {
  const html = await generateInvoiceHtml(invoice, profile);
  const { uri } = await Print.printToFileAsync({ html });
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64;
}

// ─── Génération PDF Factur-X base64 (réutilisable) ───────────────────────────
export async function generateFacturXBase64(invoice: Invoice, profile: Profile): Promise<string> {
  const html = await generateInvoiceHtml(invoice, profile);
  const { uri: pdfUri } = await Print.printToFileAsync({ html });
  const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
  if (!pdfBase64) throw new Error('Impossible de générer le PDF');
  const xmlContent = generateFacturXml(invoice, profile);
  const { pdfBase64: facturXBase64 } = await embedFacturX({
    pdfBase64, xmlContent, invoiceNumber: invoice.number, documentType: invoice.document_type,
  });
  return facturXBase64;
}

// ─── Génération PDF Factur-X (PDF/A-3b + XML CII embarqué) ───────────────────
export async function generateAndShareFacturXPdf(
  invoice: Invoice,
  profile: Profile
): Promise<void> {
  const html = await generateInvoiceHtml(invoice, profile);
  const { uri: pdfUri } = await Print.printToFileAsync({ html });
  const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
  if (!pdfBase64) throw new Error('Impossible de générer le PDF');

  const xmlContent = generateFacturXml(invoice, profile);

  const { pdfBase64: facturXBase64 } = await embedFacturX({
    pdfBase64,
    xmlContent,
    invoiceNumber: invoice.number,
    documentType: invoice.document_type,
  });

  const filename = `${invoice.number.replace(/[^A-Z0-9-]/gi, '_')}_facturx.pdf`;
  const pdfPath = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(pdfPath, facturXBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(pdfPath, {
    mimeType: 'application/pdf',
    dialogTitle: `Factur-X — ${invoice.number}`,
    UTI: 'com.adobe.pdf',
  });
}

// ─── Récapitulatif annuel PDF ─────────────────────────────────────────────────
export async function generateAndShareAnnualReport(
  invoices: Invoice[],
  profile: Profile,
  year?: number
): Promise<void> {
  const targetYear = year || new Date().getFullYear();
  const accentColor = profile.accent_color || '#1D9E75';
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const yearInvoices = invoices.filter((inv) => {
    const ref = inv.issue_date || inv.created_at;
    return ref && ref.startsWith(String(targetYear)) && inv.document_type === 'invoice';
  });

  const paidInvoices = yearInvoices.filter((inv) => inv.status === 'paid');
  const totalCA = paidInvoices.reduce((s, inv) => s + inv.total, 0);
  const totalHT = paidInvoices.reduce((s, inv) => s + inv.subtotal, 0);
  const totalTVA = paidInvoices.reduce((s, inv) => s + inv.vat_amount, 0);
  const totalPending = yearInvoices.filter((inv) => inv.status === 'sent' || inv.status === 'overdue').reduce((s, inv) => s + inv.total, 0);
  const totalOverdue = yearInvoices.filter((inv) => inv.status === 'overdue').reduce((s, inv) => s + inv.total, 0);

  // Top clients
  const clientMap: Record<string, { name: string; total: number; count: number }> = {};
  paidInvoices.forEach((inv) => {
    const name = inv.client?.name || inv.client_name_override || 'Sans nom';
    if (!clientMap[name]) clientMap[name] = { name, total: 0, count: 0 };
    clientMap[name].total += inv.total;
    clientMap[name].count += 1;
  });
  const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 5);

  // Par mois
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(targetYear, i, 1);
    const label = d.toLocaleString('fr-FR', { month: 'long' });
    const monthStr = `${targetYear}-${String(i + 1).padStart(2, '0')}`;
    const paid = paidInvoices.filter((inv) => (inv.paid_at || inv.issue_date || '').startsWith(monthStr)).reduce((s, inv) => s + inv.total, 0);
    return { label: label.charAt(0).toUpperCase() + label.slice(1), paid };
  });
  const maxMonth = Math.max(...months.map((m) => m.paid), 1);

  const monthRows = months.map((m) => {
    const barW = Math.round((m.paid / maxMonth) * 200);
    return `<tr>
      <td style="padding:8px 12px;font-size:12px;color:#374151;width:100px;border-bottom:1px solid #f3f4f6">${m.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        ${m.paid > 0 ? `<div style="height:12px;width:${barW}px;background:${accentColor};border-radius:6px;display:inline-block"></div>` : '<span style="color:#d1d5db;font-size:11px">—</span>'}
      </td>
      <td style="padding:8px 12px;font-size:12px;font-weight:${m.paid > 0 ? '700' : '400'};color:${m.paid > 0 ? '#111827' : '#9ca3af'};text-align:right;border-bottom:1px solid #f3f4f6">${m.paid > 0 ? fmt(m.paid) : '—'}</td>
    </tr>`;
  }).join('');

  const clientRows = topClients.length > 0 ? topClients.map((c, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600">${c.name}</td>
      <td style="padding:10px 14px;font-size:13px;color:#6b7280;text-align:center">${c.count}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:${accentColor};text-align:right">${fmt(c.total)}</td>
    </tr>`).join('') : '<tr><td colspan="3" style="padding:20px;text-align:center;color:#9ca3af">Aucune facture payée cette année</td></tr>';

  const generatedAt = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Arial,sans-serif; background:#fff; color:#111827 }
  @page { margin:0; size:A4 }
</style></head><body>

<!-- HEADER -->
<div style="background:${accentColor};padding:48px 56px 40px">
  <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Récapitulatif annuel</div>
  <div style="font-size:36px;font-weight:900;color:#fff;letter-spacing:-1px">${targetYear}</div>
  <div style="font-size:16px;color:rgba(255,255,255,0.8);margin-top:6px;font-weight:600">${profile.company_name || ''}</div>
  ${profile.siret ? `<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px">SIRET ${profile.siret}</div>` : ''}
  <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:8px">Généré le ${generatedAt}</div>
</div>

<div style="padding:44px 56px">

<!-- KPIs -->
<div style="display:flex;gap:16px;margin-bottom:44px;flex-wrap:wrap">
  <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:12px;padding:20px;border:1px solid #f3f4f6">
    <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">CA Encaissé TTC</div>
    <div style="font-size:26px;font-weight:900;color:${accentColor}">${fmt(totalCA)}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px">${paidInvoices.length} factures</div>
  </div>
  <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:12px;padding:20px;border:1px solid #f3f4f6">
    <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Chiffre d'affaires HT</div>
    <div style="font-size:26px;font-weight:900;color:#111827">${fmt(totalHT)}</div>
  </div>
  <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:12px;padding:20px;border:1px solid #f3f4f6">
    <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">TVA Collectée</div>
    <div style="font-size:26px;font-weight:900;color:#111827">${fmt(totalTVA)}</div>
  </div>
  ${totalPending > 0 ? `<div style="flex:1;min-width:120px;background:#FEF3C7;border-radius:12px;padding:20px;border:1px solid #FDE68A">
    <div style="font-size:10px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">En attente</div>
    <div style="font-size:26px;font-weight:900;color:#D97706">${fmt(totalPending)}</div>
    ${totalOverdue > 0 ? `<div style="font-size:11px;color:#EF4444;margin-top:4px;font-weight:600">${fmt(totalOverdue)} en retard</div>` : ''}
  </div>` : ''}
</div>

<!-- CA PAR MOIS -->
<div style="margin-bottom:40px">
  <div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #f3f4f6">CA mensuel</div>
  <table style="width:100%;border-collapse:collapse">
    <tbody>${monthRows}</tbody>
  </table>
</div>

<!-- TOP CLIENTS -->
<div style="margin-bottom:40px">
  <div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #f3f4f6">Top clients</div>
  <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden">
    <thead>
      <tr style="background:#f9fafb;border-bottom:2px solid ${accentColor}">
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.8px;text-align:left">Client</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.8px;text-align:center">Factures</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.8px;text-align:right">CA</th>
      </tr>
    </thead>
    <tbody>${clientRows}</tbody>
  </table>
</div>

<div style="border-top:1px solid #f3f4f6;padding-top:16px;font-size:10px;color:#9ca3af;text-align:center;line-height:1.8">
  Bilan généré avec Factu.me · ${profile.company_name || ''} · SIRET ${profile.siret || 'N/A'}
</div>
</div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  const filename = `bilan_${targetYear}_${(profile.company_name || 'entreprise').replace(/\s/g, '_')}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: `Bilan ${targetYear}` });
}

// ─── HTML d'email ─────────────────────────────────────────────────────────────
export function generateEmailHtml(invoice: Invoice, profile: Profile): string {
  const accentColor = profile.accent_color || '#1D9E75';
  const clientName = invoice.client?.name || invoice.client_name_override || 'Client';
  const docLabel = getDocLabel(invoice, profile.language || 'fr');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9fafb;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: ${accentColor}; font-size: 24px; margin-bottom: 8px;">${profile.company_name}</h1>
    <p style="color: #6b7280; margin-bottom: 24px;">Bonjour ${clientName},</p>
    <p style="color: #374151; line-height: 1.7; margin-bottom: 16px;">
      Veuillez trouver ci-joint votre ${docLabel.toLowerCase()} <strong>${invoice.number}</strong>
      d'un montant de <strong>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total)}</strong>.
    </p>
    ${invoice.due_date ? `<p style="color: #374151;">Date d'échéance : <strong>${new Date(invoice.due_date).toLocaleDateString('fr-FR')}</strong></p>` : ''}
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        Pour toute question, n'hésitez pas à nous contacter.
      </p>
    </div>
    <p style="color: #374151; margin-bottom: 8px;">Cordialement,</p>
    <p style="color: ${accentColor}; font-weight: 700;">${profile.company_name}</p>
  </div>
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
    Document généré avec Factu.me — Tu parles, on facture.
  </p>
</body>
</html>`;
}
