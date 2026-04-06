import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import fr from './fr';
import en from './en';

const LANGUAGE_KEY = '@factume_language';

export const getStoredLanguage = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored) return stored;
    // Fallback to device locale
    const deviceLocale = Localization.getLocales()[0]?.languageCode || 'fr';
    return deviceLocale === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
};

export const setStoredLanguage = async (lang: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // ignore
  }
};

export const changeLanguage = async (lang: 'fr' | 'en'): Promise<void> => {
  await setStoredLanguage(lang);
  await i18n.changeLanguage(lang);
};

const initI18n = async () => {
  const lng = await getStoredLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      lng,
      fallbackLng: 'fr',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
    });
};

// Initialize immediately (non-blocking — React renders after)
initI18n().catch(console.error);

export default i18n;
