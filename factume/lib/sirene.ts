// API Annuaire des entreprises — gratuite, sans clé API
// https://recherche-entreprises.api.gouv.fr

export interface SireneResult {
  siren: string;
  siret: string; // siret du siège
  nom_complet: string;
  nom_raison_sociale: string;
  adresse: string;
  code_postal: string;
  ville: string;
  activite_principale: string; // code NAF
  nature_juridique: string;
  tranche_effectif_salarie: string;
}

export async function searchEntreprises(query: string): Promise<SireneResult[]> {
  if (!query || query.trim().length < 2) return [];

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query.trim())}&per_page=8&status=A`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const results: SireneResult[] = (json.results || []).map((item: any) => {
      const siege = item.siege || {};
      return {
        siren: item.siren || '',
        siret: siege.siret || '',
        nom_complet: item.nom_complet || item.nom_raison_sociale || '',
        nom_raison_sociale: item.nom_raison_sociale || '',
        adresse: siege.adresse || '',
        code_postal: siege.code_postal || '',
        ville: siege.commune || '',
        activite_principale: item.activite_principale || '',
        nature_juridique: item.nature_juridique || '',
        tranche_effectif_salarie: item.tranche_effectif_salarie || '',
      };
    });
    return results;
  } catch {
    return [];
  }
}

// Recherche directe par SIRET
export async function fetchBySiret(siret: string): Promise<SireneResult | null> {
  const clean = siret.replace(/\s/g, '');
  if (clean.length !== 14) return null;

  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${clean}&per_page=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.results?.[0];
    if (!item) return null;
    const siege = item.siege || {};
    return {
      siren: item.siren || '',
      siret: siege.siret || clean,
      nom_complet: item.nom_complet || '',
      nom_raison_sociale: item.nom_raison_sociale || '',
      adresse: siege.adresse || '',
      code_postal: siege.code_postal || '',
      ville: siege.commune || '',
      activite_principale: item.activite_principale || '',
      nature_juridique: item.nature_juridique || '',
      tranche_effectif_salarie: item.tranche_effectif_salarie || '',
    };
  } catch {
    return null;
  }
}
