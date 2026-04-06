import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

export const CURRENCIES: Array<{ code: Currency; symbol: string; label: string; flag: string }> = [
  { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺' },
  { code: 'USD', symbol: '$', label: 'Dollar US', flag: '🇺🇸' },
  { code: 'GBP', symbol: '£', label: 'Livre Sterling', flag: '🇬🇧' },
  { code: 'CHF', symbol: 'CHF', label: 'Franc Suisse', flag: '🇨🇭' },
];

const STORAGE_KEY = '@facture_currency';
const RATES_KEY = '@facture_rates';
const RATES_TTL = 6 * 60 * 60 * 1000; // 6h

interface RatesCache {
  base: Currency;
  rates: Record<Currency, number>;
  fetchedAt: number;
}

// Taux de fallback si l'API est inaccessible
const FALLBACK_RATES: Record<Currency, number> = {
  EUR: 1,
  USD: 1.09,
  GBP: 0.86,
  CHF: 0.97,
};

async function fetchRates(base: Currency = 'EUR'): Promise<Record<Currency, number>> {
  try {
    const cached = await AsyncStorage.getItem(RATES_KEY);
    if (cached) {
      const parsed: RatesCache = JSON.parse(cached);
      if (parsed.base === base && Date.now() - parsed.fetchedAt < RATES_TTL) {
        return parsed.rates;
      }
    }
    // API gratuite, pas de clé requise
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=USD,GBP,CHF,EUR`);
    if (!res.ok) throw new Error('API unavailable');
    const data = await res.json();
    const rates: Record<Currency, number> = { EUR: 1, USD: 1, GBP: 1, CHF: 1 };
    rates[base] = 1;
    if (data.rates) {
      Object.assign(rates, data.rates);
    }
    const cache: RatesCache = { base, rates, fetchedAt: Date.now() };
    await AsyncStorage.setItem(RATES_KEY, JSON.stringify(cache));
    return rates;
  } catch {
    return FALLBACK_RATES;
  }
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>('EUR');
  const [rates, setRates] = useState<Record<Currency, number>>(FALLBACK_RATES);
  const [loadingRates, setLoadingRates] = useState(false);

  // Charger la devise sauvegardée
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && CURRENCIES.find((c) => c.code === saved)) {
        setCurrencyState(saved as Currency);
      }
    });
  }, []);

  // Charger les taux quand la devise change
  useEffect(() => {
    setLoadingRates(true);
    fetchRates('EUR').then((r) => {
      setRates(r);
      setLoadingRates(false);
    });
  }, []);

  const setCurrency = useCallback(async (code: Currency) => {
    setCurrencyState(code);
    await AsyncStorage.setItem(STORAGE_KEY, code);
  }, []);

  // Convertit un montant en EUR vers la devise active
  const convert = useCallback(
    (amountEur: number): number => {
      if (currency === 'EUR') return amountEur;
      const rate = rates[currency] ?? FALLBACK_RATES[currency];
      return amountEur * rate;
    },
    [currency, rates]
  );

  // Formate un montant en EUR → devise active
  const format = useCallback(
    (amountEur: number): string => {
      const converted = convert(amountEur);
      const info = CURRENCIES.find((c) => c.code === currency)!;
      if (currency === 'EUR') {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(converted);
      }
      return `${info.symbol}${converted.toFixed(2)}`;
    },
    [currency, convert]
  );

  const currencyInfo = CURRENCIES.find((c) => c.code === currency)!;

  return { currency, setCurrency, rates, loadingRates, convert, format, currencyInfo, CURRENCIES };
}
