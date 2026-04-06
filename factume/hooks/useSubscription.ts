import { useAuthStore } from '../stores/authStore';

export type SubscriptionTier = 'free' | 'solo' | 'pro';

export interface SubscriptionFeatures {
  tier: SubscriptionTier;
  isFree: boolean;
  isSolo: boolean; // solo OR pro
  isPro: boolean;
  maxInvoices: number; // Infinity si solo/pro
  canExportCsv: boolean;
  canSendReminder: boolean;
  canWhatsApp: boolean;
  canCustomTemplate: boolean;
  canMultipleTemplates: boolean; // templates 2 et 3
  canRemoveWatermark: boolean;
  canStripePayment: boolean; // pro only
  canFacturX: boolean; // pro only
  canImportClients: boolean; // solo+ only
}

export function useSubscription(): SubscriptionFeatures {
  const profile = useAuthStore((s) => s.profile);
  const tier = (profile?.subscription_tier as SubscriptionTier) || 'free';

  return {
    tier,
    isFree: tier === 'free',
    isSolo: tier === 'solo' || tier === 'pro',
    isPro: tier === 'pro',
    maxInvoices: tier === 'free' ? 5 : Infinity,
    canExportCsv: tier !== 'free',
    canSendReminder: tier !== 'free',
    canWhatsApp: tier === 'pro',
    canCustomTemplate: tier !== 'free',
    canMultipleTemplates: tier !== 'free',
    canRemoveWatermark: tier !== 'free',
    canStripePayment: tier === 'pro',
    canFacturX: tier === 'pro',
    canImportClients: tier !== 'free',
  };
}
