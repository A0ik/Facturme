/**
 * Génération XML Factur-X (profil MINIMUM / EN 16931)
 * Compatible avec la réglementation e-invoicing 2026 française.
 * Le XML est produit selon la norme CII (Cross Industry Invoice) UN/CEFACT.
 */

import { Invoice, Profile } from '../types';

function escXml(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(d?: string): string {
  if (!d) return new Date().toISOString().split('T')[0].replace(/-/g, '');
  return d.replace(/-/g, '');
}

function formatAmount(n: number): string {
  return n.toFixed(2);
}

/** TypeCode CII selon le type de document :
 * 380 = Commercial Invoice (Facture)
 * 381 = Credit Note (Avoir)
 */
function getTypeCode(invoice: Invoice): string {
  return invoice.document_type === 'credit_note' ? '381' : '380';
}

/** BT-81 — PaymentMeansCode UNCL4461
 * 30 = virement (défaut)
 * 48 = carte bancaire
 * 58 = SEPA Credit Transfer
 * 10 = espèces
 */
function getPaymentMeansCode(method?: string): string {
  if (!method) return '30';
  const m = method.toLowerCase();
  if (m.includes('carte') || m.includes('card') || m.includes('cb')) return '48';
  if (m.includes('sepa')) return '58';
  if (m.includes('espece') || m.includes('cash')) return '10';
  return '30';
}

export function generateFacturXml(invoice: Invoice, profile: Profile): string {
  const clientName = invoice.client?.name || invoice.client_name_override || 'Client';
  const clientEmail = invoice.client?.email || '';
  const clientAddress = invoice.client?.address || '';
  const clientCity = invoice.client?.city || '';
  const clientPostal = invoice.client?.postal_code || '';
  const clientSiret = invoice.client?.siret || '';
  const clientVat = invoice.client?.vat_number || '';

  // Franchise en base de TVA (art. 293 B CGI) : pas de numéro TVA vendeur
  const isFranchiseTva = !profile.vat_number;

  // Grouper les lignes par taux TVA pour résumé
  const vatGroups: Record<number, { base: number; amount: number }> = {};
  for (const item of invoice.items) {
    const rate = item.vat_rate;
    if (!vatGroups[rate]) vatGroups[rate] = { base: 0, amount: 0 };
    const base = item.quantity * item.unit_price;
    vatGroups[rate].base += base;
    vatGroups[rate].amount += base * (rate / 100);
  }

  const vatSummaryLines = Object.entries(vatGroups)
    .map(([rate, v]) => {
      if (isFranchiseTva) {
        return `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount currencyID="EUR">0.00</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:ExemptionReasonCode>AAM</ram:ExemptionReasonCode>
      <ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>
      <ram:BasisAmount currencyID="EUR">${formatAmount(v.base)}</ram:BasisAmount>
      <ram:CategoryCode>E</ram:CategoryCode>
      <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`;
      }
      return `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount currencyID="EUR">${formatAmount(v.amount)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount currencyID="EUR">${formatAmount(v.base)}</ram:BasisAmount>
      <ram:CategoryCode>S</ram:CategoryCode>
      <ram:RateApplicablePercent>${Number(rate).toFixed(2)}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`;
    })
    .join('');

  const lineItems = invoice.items
    .map(
      (item, i) => `
  <ram:IncludedSupplyChainTradeLineItem>
    <ram:AssociatedDocumentLineDocument>
      <ram:LineID>${i + 1}</ram:LineID>
    </ram:AssociatedDocumentLineDocument>
    <ram:SpecifiedTradeProduct>
      <ram:Name>${escXml(item.description)}</ram:Name>
    </ram:SpecifiedTradeProduct>
    <ram:SpecifiedLineTradeAgreement>
      <ram:NetPriceProductTradePrice>
        <ram:ChargeAmount currencyID="EUR">${formatAmount(item.unit_price)}</ram:ChargeAmount>
      </ram:NetPriceProductTradePrice>
    </ram:SpecifiedLineTradeAgreement>
    <ram:SpecifiedLineTradeDelivery>
      <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
    </ram:SpecifiedLineTradeDelivery>
    <ram:SpecifiedLineTradeSettlement>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${isFranchiseTva
          ? `<ram:ExemptionReasonCode>AAM</ram:ExemptionReasonCode>
        <ram:CategoryCode>E</ram:CategoryCode>
        <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>`
          : `<ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${Number(item.vat_rate).toFixed(2)}</ram:RateApplicablePercent>`}
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementLineMonetarySummation>
        <ram:LineTotalAmount currencyID="EUR">${formatAmount(item.quantity * item.unit_price)}</ram:LineTotalAmount>
      </ram:SpecifiedTradeSettlementLineMonetarySummation>
    </ram:SpecifiedLineTradeSettlement>
  </ram:IncludedSupplyChainTradeLineItem>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <!-- Contexte Factur-X EN 16931 — BT-23 + BT-24 -->
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>A1</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <!-- En-tête facture -->
  <rsm:ExchangedDocument>
    <ram:ID>${escXml(invoice.number)}</ram:ID>
    <ram:TypeCode>${getTypeCode(invoice)}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${isoDate(invoice.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote><ram:Content>${escXml(invoice.notes)}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>

    <!-- Lignes de facturation -->
    ${lineItems}

    <!-- Accord commercial -->
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${escXml(invoice.number)}</ram:BuyerReference>

      <!-- Vendeur (notre entreprise) — BT-27, BT-30, BT-34 -->
      <ram:SellerTradeParty>
        <ram:Name>${escXml(profile.company_name)}</ram:Name>
        ${profile.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${escXml(profile.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${escXml(profile.address)}</ram:LineOne>
          <ram:PostcodeCode>${escXml(profile.postal_code)}</ram:PostcodeCode>
          <ram:CityName>${escXml(profile.city)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${profile.vat_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escXml(profile.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
        <!-- BT-34 : adresse électronique du vendeur (routage e-invoicing) -->
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${escXml(profile.email)}</ram:URIID>
        </ram:URIUniversalCommunication>
      </ram:SellerTradeParty>

      <!-- Acheteur (client) — BT-44, BT-46, BT-48, BT-49 -->
      <ram:BuyerTradeParty>
        <ram:Name>${escXml(clientName)}</ram:Name>
        ${clientSiret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${escXml(clientSiret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        ${clientAddress || clientCity ? `
        <ram:PostalTradeAddress>
          <ram:LineOne>${escXml(clientAddress)}</ram:LineOne>
          <ram:PostcodeCode>${escXml(clientPostal)}</ram:PostcodeCode>
          <ram:CityName>${escXml(clientCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>` : ''}
        ${clientVat ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escXml(clientVat)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
        ${clientEmail ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${escXml(clientEmail)}</ram:URIID></ram:URIUniversalCommunication>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <!-- Livraison -->
    <ram:ApplicableHeaderTradeDelivery/>

    <!-- Règlement -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <!-- BT-81 : moyen de paiement -->
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${getPaymentMeansCode(invoice.payment_method)}</ram:TypeCode>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      ${vatSummaryLines}
      ${invoice.due_date ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${isoDate(invoice.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount currencyID="EUR">${formatAmount(invoice.subtotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount currencyID="EUR">${formatAmount(invoice.subtotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${formatAmount(invoice.vat_amount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount currencyID="EUR">${formatAmount(invoice.total)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount currencyID="EUR">${formatAmount(invoice.total)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

/** Partager le XML Factur-X via expo-sharing */
export async function shareFacturXml(invoice: Invoice, profile: Profile): Promise<string> {
  const { writeAsStringAsync, documentDirectory, EncodingType } = await import('expo-file-system/legacy');
  const { shareAsync } = await import('expo-sharing');

  const xml = generateFacturXml(invoice, profile);
  const filename = `${invoice.number.replace(/[^A-Z0-9-]/gi, '_')}_facturx.xml`;
  const path = `${documentDirectory}${filename}`;

  await writeAsStringAsync(path, xml, { encoding: EncodingType.UTF8 });
  await shareAsync(path, { mimeType: 'application/xml', UTI: 'public.xml' });
  return path;
}
