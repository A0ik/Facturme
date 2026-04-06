import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../../stores/authStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { LegalStatus } from '../../../types';
import { useSubscription } from '../../../hooks/useSubscription';
import { useCurrency, CURRENCIES } from '../../../hooks/useCurrency';
import { Ionicons } from '@expo/vector-icons';
import { analyzeTemplate, getStripeConnectUrl, exchangeStripeCode, deleteAccount } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { changeLanguage } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { searchEntreprises, fetchBySiret, SireneResult } from '../../../lib/sirene';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TEMPLATES: Array<{ id: number; name: string; desc: string; icon: IoniconsName; pro?: boolean }> = [
  { id: 1, name: 'Minimaliste', desc: 'Épuré, moderne.', icon: 'remove-outline' },
  { id: 2, name: 'Classique', desc: 'Structure traditionnelle.', icon: 'document-text-outline' },
  { id: 3, name: 'Moderne', desc: 'Coloré et dynamique.', icon: 'color-palette-outline' },
  { id: 4, name: 'Custom IA', desc: 'Votre propre template analysé par l\'IA.', icon: 'sparkles-outline', pro: true },
];

const ACCENT_COLORS = [
  '#1D9E75', '#3B82F6', '#8B5CF6', '#EF9F27', '#EF4444', '#06B6D4', '#1F2937',
];

const LEGAL_STATUSES: Array<{ value: LegalStatus; label: string }> = [
  { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'eirl', label: 'EIRL' },
  { value: 'eurl', label: 'EURL' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sas', label: 'SAS' },
  { value: 'sasu', label: 'SASU' },
  { value: 'sa', label: 'SA' },
  { value: 'autre', label: 'Autre' },
];

const PLAN_COLORS = {
  free: Colors.gray500,
  solo: Colors.primary,
  pro: Colors.accent,
} as const;

type Section = 'profile' | 'company' | 'plans' | null;

export default function Settings() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, profile, updateProfile, signOut, fetchProfile, loading } = useAuthStore();
  const { currency, setCurrency } = useCurrency();

  const [activeSection, setActiveSection] = useState<Section>(null);
  const [savingSection, setSavingSection] = useState<Section>(null);

  // Apparence
  const [selectedTemplate, setSelectedTemplate] = useState(profile?.template_id || 1);
  const [selectedColor, setSelectedColor] = useState(profile?.accent_color || Colors.primary);
  const [analyzingTemplate, setAnalyzingTemplate] = useState(false);

  // Champs profil
  const [email, setEmail] = useState(profile?.email || '');

  // Champs entreprise
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [siret, setSiret] = useState(profile?.siret || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [city, setCity] = useState(profile?.city || '');
  const [postalCode, setPostalCode] = useState(profile?.postal_code || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [legalStatus, setLegalStatus] = useState<LegalStatus>(
    (profile?.legal_status as LegalStatus) || 'auto-entrepreneur'
  );
  const [logoUri, setLogoUri] = useState<string | null>(profile?.logo_url || null);
  const [logoError, setLogoError] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [invoicePrefix, setInvoicePrefix] = useState(profile?.invoice_prefix || 'FACT');
  const [savingPrefix, setSavingPrefix] = useState(false);
  const [vatNumber, setVatNumber] = useState(profile?.vat_number || '');

  // ----- Recherche Sirene -----
  const [searchResults, setSearchResults] = useState<SireneResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (companyName.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchEntreprises(companyName);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 500);
  }, [companyName]);

  useEffect(() => {
    const clean = siret.replace(/\s/g, '');
    if (clean.length === 14) {
      fetchBySiret(clean).then((result) => {
        if (result) {
          setCompanyName(result.nom_complet || companyName);
          setAddress(result.adresse || address);
          setCity(result.ville || city);
          setPostalCode(result.code_postal || postalCode);
        }
      });
    }
  }, [siret]);

  const selectEntreprise = (item: SireneResult) => {
    let vatNum = '';
    if (item.siret && legalStatus !== 'auto-entrepreneur') {
      const siren = item.siret.slice(0, 9);
      const key = (12 + 3 * (parseInt(siren) % 97)) % 97;
      vatNum = `FR${String(key).padStart(2, '0')}${siren}`;
    }

    setCompanyName(item.nom_complet);
    setSiret(item.siret || '');
    setAddress(item.adresse || '');
    setCity(item.ville || '');
    setPostalCode(item.code_postal || '');
    if (vatNum) setVatNumber(vatNum);
    setShowDropdown(false);
    setSearchResults([]);
  };
  // -----------------------------

  useEffect(() => {
    if (profile) {
      setEmail(profile.email || '');
      setCompanyName(profile.company_name || '');
      setSiret(profile.siret || '');
      setAddress(profile.address || '');
      setCity(profile.city || '');
      setPostalCode(profile.postal_code || '');
      setPhone(profile.phone || '');
      setLegalStatus((profile.legal_status as LegalStatus) || 'auto-entrepreneur');
      setLogoUri(profile.logo_url || null);
      setLogoError(false);
      setSelectedTemplate(profile.template_id || 1);
      setSelectedColor(profile.accent_color || Colors.primary);
      setInvoicePrefix(profile.invoice_prefix || 'FACT');
      setVatNumber(profile.vat_number || '');
    }
  }, [profile]);

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.error'), t('settings.profile.permissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0] && user?.id) {
      const localUri = result.assets[0].uri;
      setLogoUri(localUri);
      setLogoError(false);
      setLogoUploading(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const path = `${user.id}/logo.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
        const publicUrl = urlData.publicUrl;
        setLogoUri(publicUrl);
        await updateProfile({ logo_url: publicUrl } as any);
      } catch (error: any) {
        Alert.alert('Erreur d\'upload', `Impossible de sauvegarder le logo sur Supabase: ${error.message || 'Erreur inconnue'}`);
        // Reset logo to previous
        setLogoUri(profile?.logo_url || null);
      } finally {
        setLogoUploading(false);
      }
    }
  };

  const handleSaveCompany = async () => {
    if (!companyName.trim()) {
      Alert.alert(t('common.error'), t('settings.profile.errorReq'));
      return;
    }
    setSavingSection('company');
    try {
      let finalVatNumber = vatNumber;
      if (!finalVatNumber && siret && legalStatus !== 'auto-entrepreneur') {
        const siren = siret.slice(0, 9);
        const key = (12 + 3 * (parseInt(siren) % 97)) % 97;
        finalVatNumber = `FR${String(key).padStart(2, '0')}${siren}`;
      }

      await updateProfile({
        company_name: companyName,
        siret,
        address,
        city,
        postal_code: postalCode,
        phone,
        legal_status: legalStatus,
        vat_number: finalVatNumber,
        logo_url: logoUri || undefined,
      } as any);
      setActiveSection(null);
      Alert.alert(t('common.save') + ' ✓', t('settings.profile.savedMsg'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveAppearance = async () => {
    setSavingSection('plans');
    try {
      await updateProfile({ template_id: selectedTemplate, accent_color: selectedColor } as any);
      setActiveSection(null);
      Alert.alert(t('common.save') + ' ✓', t('settings.appearance.savedMsg'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleUploadCustomTemplate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const pdfUri = result.assets[0].uri;
      setAnalyzingTemplate(true);
      const { html } = await analyzeTemplate(pdfUri);
      await updateProfile({ custom_template_html: html, template_id: 4 } as any);
      setSelectedTemplate(4);
      Alert.alert(t('settings.appearance.templateReady'), t('settings.appearance.templateReadyMsg'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Error');
    } finally {
      setAnalyzingTemplate(false);
    }
  };

  const handleSavePrefix = async () => {
    const prefix = invoicePrefix.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 8) || 'FACT';
    setInvoicePrefix(prefix);
    setSavingPrefix(true);
    try {
      await updateProfile({ invoice_prefix: prefix } as any);
      const year = new Date().getFullYear();
      Alert.alert(t('common.save') + ' ✓', t('settings.prefix.savedMsg', { prefix, year }));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setSavingPrefix(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.danger.logout'), t('settings.danger.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.danger.logout'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const sub = useSubscription();
  const [stripeConnecting, setStripeConnecting] = useState(false);

  const handleStripeConnect = async () => {
    setStripeConnecting(true);
    try {
      const { url } = await getStripeConnectUrl();
      const redirectUri = Linking.createURL('stripe-connect');
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const code = parsed.queryParams?.code as string | undefined;
        if (!code) throw new Error(t('settings.stripe.oauthError'));
        const { stripe_account_id } = await exchangeStripeCode(code);
        await updateProfile({ stripe_account_id } as any);
        Alert.alert(t('settings.stripe.connectedMsg'), t('settings.stripe.connectedDesc'));
      }
    } catch (err: any) {
      if (!err.message?.includes('cancel') && !err.message?.includes('dismiss')) {
        Alert.alert(t('common.error'), err.message);
      }
    } finally {
      setStripeConnecting(false);
    }
  };

  const handleStripeDisconnect = () => {
    Alert.alert(t('settings.stripe.disconnect'), t('settings.stripe.disconnectConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.stripe.disconnect'),
        style: 'destructive',
        onPress: async () => {
          try {
            await updateProfile({ stripe_account_id: undefined } as any);
          } catch (err: any) {
            Alert.alert(t('common.error'), err.message);
          }
        },
      },
    ]);
  };

  const currentPlan = profile?.subscription_tier || 'free';
  const initials = (profile?.company_name || profile?.email || 'M').charAt(0).toUpperCase();

  const PLANS = [
    {
      id: 'free',
      name: t('settings.plans.free.name'),
      price: t('settings.plans.free.price'),
      features: t('settings.plans.free.features', { returnObjects: true }) as string[],
      color: PLAN_COLORS.free,
    },
    {
      id: 'solo',
      name: t('settings.plans.solo.name'),
      price: t('settings.plans.solo.price'),
      features: t('settings.plans.solo.features', { returnObjects: true }) as string[],
      color: PLAN_COLORS.solo,
      recommended: true,
    },
    {
      id: 'pro',
      name: t('settings.plans.pro.name'),
      price: t('settings.plans.pro.price'),
      features: t('settings.plans.pro.features', { returnObjects: true }) as string[],
      color: PLAN_COLORS.pro,
    },
  ];

  const handleChangeLanguage = async (lang: 'fr' | 'en') => {
    try {
      await changeLanguage(lang);
      await updateProfile({ language: lang } as any);
    } catch {
      // ignore
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>{t('settings.title')}</Text>

        {/* === MON PROFIL === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.profile')}</Text>
          <View style={styles.card}>
            {/* Avatar / logo */}
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={pickLogo} activeOpacity={0.8} disabled={logoUploading}>
                {logoUri && !logoError ? (
                  <Image source={{ uri: logoUri }} style={styles.avatarLogo} onError={() => setLogoError(true)} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  {logoUploading
                    ? <ActivityIndicator size={10} color={Colors.textPrimary} />
                    : <Ionicons name="pencil" size={10} color={Colors.textPrimary} />
                  }
                </View>
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {profile?.company_name || t('settings.profile.myCompany')}
                </Text>
                <Text style={styles.profileEmail}>{profile?.email}</Text>
                <Text style={styles.profilePlan}>
                  Plan {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* === INFORMATIONS ENTREPRISE === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.companyInfo')}</Text>
          <View style={styles.card}>
            {activeSection !== 'company' ? (
              <>
                <InfoRow label={t('settings.profile.companyName')} value={profile?.company_name || '—'} />
                <InfoRow label={t('settings.profile.siret')} value={profile?.siret || t('settings.profile.notProvided')} />
                <InfoRow label={t('settings.profile.vatNumber')} value={profile?.vat_number || t('settings.profile.notCalculated')} />
                <InfoRow
                  label={t('settings.profile.address')}
                  value={
                    [
                      profile?.address,
                      profile?.postal_code && profile?.city
                        ? `${profile.postal_code} ${profile.city}`
                        : profile?.city || profile?.postal_code,
                    ]
                      .filter(Boolean)
                      .join(', ') || t('settings.profile.notProvided')
                  }
                />
                <InfoRow label={t('settings.profile.phone')} value={profile?.phone || t('settings.profile.notProvided')} />
                <InfoRow
                  label={t('settings.profile.legalStatus')}
                  value={
                    LEGAL_STATUSES.find((s) => s.value === profile?.legal_status)?.label ||
                    'Auto-entrepreneur'
                  }
                  last
                />
                <TouchableOpacity
                  style={styles.editTrigger}
                  onPress={() => setActiveSection('company')}
                >
                  <Text style={styles.editTriggerText}>{t('settings.profile.editBtn')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.editForm}>
                {/* Logo dans le formulaire */}
                <View style={styles.logoSection}>
                  <Text style={styles.fieldLabel}>{t('settings.profile.logoLabel')}</Text>
                  <View style={styles.logoRow}>
                    <TouchableOpacity onPress={pickLogo} style={styles.logoBox}>
                      {logoUri && !logoError ? (
                        <Image source={{ uri: logoUri }} style={styles.logoImage} onError={() => setLogoError(true)} />
                      ) : (
                        <View style={styles.logoPlaceholder}>
                          <Ionicons name="business-outline" size={24} color={Colors.textTertiary} />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={{ gap: 8, flex: 1 }}>
                      <Button onPress={pickLogo} variant="outline" size="sm">
                        {logoUri ? t('settings.profile.changeLogo') : t('settings.profile.importLogo')}
                      </Button>
                      {logoUri && (
                        <Button
                          onPress={() => setLogoUri(null)}
                          variant="ghost"
                          size="sm"
                        >
                          {t('settings.profile.deleteLogo')}
                        </Button>
                      )}
                    </View>
                  </View>
                </View>

                <View style={{ zIndex: 10 }}>
                  <Input
                    label={t('settings.profile.companyNameLabel')}
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="Dupont Plomberie"
                    rightIcon={searching ? <ActivityIndicator size="small" color={Colors.primary} /> : undefined}
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <View style={styles.dropdown}>
                      {searchResults.map((item, i) => (
                        <TouchableOpacity
                          key={item.siret || i}
                          style={[styles.dropdownItem, i < searchResults.length - 1 && styles.dropdownItemBorder]}
                          onPress={() => selectEntreprise(item)}
                        >
                          <Text style={styles.dropdownName} numberOfLines={1}>
                            {item.nom_complet}
                          </Text>
                          <Text style={styles.dropdownSub} numberOfLines={1}>
                            {item.siret ? `SIRET ${item.siret}` : ''}{item.code_postal ? ` · ${item.code_postal} ${item.ville}` : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={styles.dropdownClose}
                        onPress={() => setShowDropdown(false)}
                      >
                        <Text style={styles.dropdownCloseText}>{t('settings.profile.close')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <Input
                  label="SIRET"
                  value={siret}
                  onChangeText={(v) => setSiret(v.replace(/\D/g, ''))}
                  placeholder="12345678901234"
                  keyboardType="numeric"
                  maxLength={14}
                />
                <Input
                  label={t('settings.profile.vatNumber')}
                  value={vatNumber}
                  onChangeText={setVatNumber}
                  placeholder="FR12345678901"
                  autoCapitalize="characters"
                />
                <Input
                  label={t('settings.profile.address')}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="12 rue de la Paix"
                />
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <Input
                    label={t('settings.profile.postalCode')}
                    value={postalCode}
                    onChangeText={setPostalCode}
                    placeholder="75001"
                    keyboardType="numeric"
                    maxLength={5}
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label={t('settings.profile.city')}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Paris"
                    containerStyle={{ flex: 2 }}
                  />
                </View>
                <Input
                  label={t('settings.profile.phone')}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="06 12 34 56 78"
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>{t('settings.profile.legalStatus')}</Text>
                <View style={styles.statusGrid}>
                  {LEGAL_STATUSES.map((s) => (
                    <TouchableOpacity
                      key={s.value}
                      onPress={() => setLegalStatus(s.value)}
                      style={[
                        styles.statusChip,
                        legalStatus === s.value && styles.statusChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          legalStatus === s.value && styles.statusChipTextActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <Button
                    onPress={() => setActiveSection(null)}
                    variant="outline"
                    style={{ flex: 1 }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onPress={handleSaveCompany}
                    loading={savingSection === 'company'}
                    style={{ flex: 2 }}
                  >
                    {t('settings.profile.saveBtn')}
                  </Button>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* === APPARENCE === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.appearance')}</Text>
          <View style={styles.card}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>{t('settings.appearance.design')}</Text>
            <View style={{ gap: 10 }}>
              {TEMPLATES.map((tmpl) => {
                const isLocked = tmpl.pro && currentPlan === 'free';
                const isActive = selectedTemplate === tmpl.id;
                return (
                  <TouchableOpacity
                    key={tmpl.id}
                    onPress={() => {
                      if (isLocked) {
                        Alert.alert(t('common.lockedFeature'), t('settings.appearance.lockedMsg'));
                        return;
                      }
                      setSelectedTemplate(tmpl.id);
                    }}
                    style={[
                      styles.templateCard,
                      isActive && styles.templateCardActive,
                      isLocked && { opacity: 0.5 },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={tmpl.icon} size={22} color={isActive ? Colors.primary : Colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.templateCardName, isActive && { color: Colors.primary }]}>{tmpl.name}</Text>
                      <Text style={styles.templateCardDesc}>{tmpl.desc}</Text>
                    </View>
                    {isLocked && (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>Solo+</Text>
                      </View>
                    )}
                    {isActive && !isLocked && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Upload PDF Custom — visible si solo/pro */}
            {(currentPlan === 'solo' || currentPlan === 'pro') && selectedTemplate === 4 && (
              <View style={styles.customTemplateBox}>
                {analyzingTemplate ? (
                  <View style={{ alignItems: 'center', gap: 8, padding: 16 }}>
                    <ActivityIndicator color={Colors.primary} />
                    <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>
                      {t('settings.appearance.analyzing')}
                    </Text>
                  </View>
                ) : profile?.custom_template_html ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                      <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary }}>
                        {t('settings.appearance.templateApplied')}
                      </Text>
                    </View>
                    <Button onPress={handleUploadCustomTemplate} variant="outline" size="sm">
                      {t('settings.appearance.replaceTemplate')}
                    </Button>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 }}>
                      {t('settings.appearance.uploadInstructions')}
                    </Text>
                    <Button onPress={handleUploadCustomTemplate} size="sm">
                      {t('settings.appearance.uploadPdf')}
                    </Button>
                  </View>
                )}
              </View>
            )}

            {/* Couleur accent */}
            <Text style={[styles.fieldLabel, { marginTop: 20, marginBottom: 12 }]}>{t('settings.appearance.accentColor')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {ACCENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSwatchActive,
                  ]}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={16} color={Colors.white} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 12, lineHeight: 16 }}>
              {t('settings.appearance.customTemplateNote')}
            </Text>

            {/* Devise */}
            <Text style={[styles.fieldLabel, { marginTop: 20, marginBottom: 10 }]}>Devise des factures</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CURRENCIES.map((cur) => (
                <TouchableOpacity
                  key={cur.code}
                  onPress={() => setCurrency(cur.code)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: Radius.full,
                    borderWidth: 2,
                    borderColor: currency === cur.code ? Colors.primary : Colors.border,
                    backgroundColor: currency === cur.code ? Colors.primaryLight : Colors.white,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{cur.flag}</Text>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: currency === cur.code ? '700' : '500', color: currency === cur.code ? Colors.primary : Colors.textSecondary }}>
                    {cur.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6 }}>
              Taux de change mis à jour toutes les 6h via Frankfurter API.
            </Text>

            <Button
              onPress={handleSaveAppearance}
              loading={savingSection === 'plans'}
              fullWidth
              style={{ marginTop: 16 }}
            >
              {t('settings.appearance.saveBtn')}
            </Button>
          </View>
        </View>

        {/* === FACTURATION === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.invoicePrefix')}</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('settings.profile.invoicePrefix')}</Text>
            <Text style={[styles.infoValue, { marginBottom: 10, fontSize: 12 }]}>
              {t('settings.prefix.format')} {invoicePrefix.trim().toUpperCase() || 'FACT'}-{new Date().getFullYear()}-001
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
              <TextInput
                style={[styles.prefixInput]}
                value={invoicePrefix}
                onChangeText={(v) => setInvoicePrefix(v.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 8))}
                placeholder="FACT"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="characters"
                maxLength={8}
              />
              <Button onPress={handleSavePrefix} loading={savingPrefix} size="sm" style={{ flex: 1 }}>
                {t('settings.prefix.saveBtn')}
              </Button>
            </View>
            <Text style={styles.hintText}>
              {t('settings.prefix.hint')}
            </Text>
          </View>
        </View>

        {/* === BANNIÈRE UPGRADE (si plan gratuit) === */}
        {currentPlan === 'free' && (
          <TouchableOpacity
            style={styles.upgradeBanner}
            onPress={() => router.push('/(app)/paywall')}
            activeOpacity={0.9}
          >
            <View>
              <Text style={styles.upgradeBannerTitle}>{t('settings.subscription.upgradeBtn')}</Text>
              <Text style={styles.upgradeBannerSub}>{t('settings.subscription.upgradeSub')}</Text>
            </View>
            <Text style={styles.upgradeBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* === ABONNEMENT === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.subscription')}</Text>
          {PLANS.map((plan) => (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                currentPlan === plan.id && { borderColor: plan.color, borderWidth: 2 },
              ]}
            >
              {plan.recommended && currentPlan !== plan.id && (
                <View style={[styles.badge, { backgroundColor: plan.color }]}>
                  <Text style={styles.badgeText}>{t('settings.subscription.recommended')}</Text>
                </View>
              )}
              {currentPlan === plan.id && (
                <View style={[styles.badge, { backgroundColor: plan.color }]}>
                  <Text style={styles.badgeText}>{t('settings.subscription.currentPlan')}</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.planFeatureRow}>
                  <Text style={[styles.planFeatureDot, { color: plan.color }]}>●</Text>
                  <Text style={styles.planFeatureText}>{f}</Text>
                </View>
              ))}
              {currentPlan !== plan.id && plan.id !== 'free' && (
                <Button
                  onPress={async () => {
                    const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://factu.me';
                    await WebBrowser.openBrowserAsync(
                      `${WEB_URL}/checkout?plan=${plan.id}&interval=monthly`,
                      { toolbarColor: plan.color }
                    );
                    if (user) await fetchProfile(user.id);
                  }}
                  size="sm"
                  style={{ backgroundColor: plan.color, marginTop: 8 }}
                  fullWidth
                >
                  {t('settings.subscription.upgradePlanBtn', { plan: plan.name })}
                </Button>
              )}
              {currentPlan === plan.id && plan.id !== 'free' && (
                <Button
                  onPress={async () => {
                    const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://factu.me';
                    await WebBrowser.openBrowserAsync(
                      `${WEB_URL}/settings`,
                      { toolbarColor: plan.color }
                    );
                  }}
                  size="sm"
                  variant="outline"
                  style={{ borderColor: plan.color, marginTop: 8 }}
                  textStyle={{ color: plan.color }}
                  fullWidth
                >
                  Gérer mon abonnement
                </Button>
              )}
            </View>
          ))}
        </View>

        {/* === PAIEMENT STRIPE (Pro) === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.stripe')}</Text>
          <View style={styles.card}>
            {sub.isPro ? (
              <>
                {profile?.stripe_account_id ? (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successLight, borderRadius: Radius.md, padding: Spacing.md }}>
                      <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.success }}>
                          {t('settings.stripe.connected')}
                        </Text>
                        <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 }}>
                          {t('settings.stripe.account')} {profile.stripe_account_id}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 }}>
                      {t('settings.stripe.activeDesc')}
                    </Text>
                    <TouchableOpacity onPress={handleStripeDisconnect} style={{ alignItems: 'center', paddingVertical: 6 }}>
                      <Text style={{ fontSize: FontSize.xs, color: Colors.danger }}>{t('settings.stripe.disconnect')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 }}>
                      {t('settings.stripe.inactiveDesc')}
                    </Text>
                    <Button
                      onPress={handleStripeConnect}
                      loading={stripeConnecting}
                      fullWidth
                      style={{ backgroundColor: '#635BFF' }}
                    >
                      {t('settings.stripe.connectBtn')} →
                    </Button>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 }}>
                      {t('settings.stripe.secureNote')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity onPress={() => router.push('/(app)/paywall')} activeOpacity={0.8}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary }}>
                      {t('settings.stripe.proFeature')}
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 }}>
                      {t('settings.stripe.proDesc')}
                    </Text>
                  </View>
                  <Text style={{ color: Colors.primary, fontWeight: '700' }}>→</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* === SIGNATURE ÉLECTRONIQUE === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature électronique</Text>
          <View style={styles.card}>
            <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Votre signature</Text>
            <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 14, lineHeight: 16 }}>
              Ajoutée automatiquement dans la zone "Bon pour accord" de vos devis.
            </Text>
            {profile?.signature_url ? (
              <View style={{ gap: 10 }}>
                <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, alignItems: 'center', backgroundColor: Colors.surface }}>
                  <Image
                    source={{ uri: profile.signature_url }}
                    style={{ height: 64, width: '100%', resizeMode: 'contain' }}
                  />
                </View>
                <Button
                  onPress={async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) { Alert.alert('Permission refusée'); return; }
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: false, quality: 0.9 });
                    if (!result.canceled && result.assets[0] && user?.id) {
                      try {
                        const sigBase64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
                        const sigBinary = atob(sigBase64);
                        const sigBytes = new Uint8Array(sigBinary.length);
                        for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);
                        const path = `${user.id}/signature.png`;
                        const { error: uploadError } = await supabase.storage.from('logos').upload(path, sigBytes, { contentType: 'image/png', upsert: true });
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
                        await updateProfile({ signature_url: urlData.publicUrl } as any);
                        Alert.alert('Signature mise à jour ✓');
                      } catch (err: any) { Alert.alert('Erreur', err.message); }
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  Changer la signature
                </Button>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Supprimer la signature', 'Voulez-vous supprimer votre signature ?', [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await updateProfile({ signature_url: undefined } as any); } catch (err: any) { Alert.alert('Erreur', err.message); } } },
                    ]);
                  }}
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: FontSize.xs, color: Colors.danger }}>Supprimer la signature</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Button
                onPress={async () => {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!perm.granted) { Alert.alert('Permission refusée'); return; }
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: false, quality: 0.9 });
                  if (!result.canceled && result.assets[0] && user?.id) {
                    try {
                      const sigBase64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
                      const sigBinary = atob(sigBase64);
                      const sigBytes = new Uint8Array(sigBinary.length);
                      for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);
                      const path = `${user.id}/signature.png`;
                      const { error: uploadError } = await supabase.storage.from('logos').upload(path, sigBytes, { contentType: 'image/png', upsert: true });
                      if (uploadError) throw uploadError;
                      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
                      await updateProfile({ signature_url: urlData.publicUrl } as any);
                      Alert.alert('Signature enregistrée ✓', 'Elle apparaîtra dans vos devis.');
                    } catch (err: any) { Alert.alert('Erreur', err.message); }
                  }
                }}
                variant="outline"
                fullWidth
              >
                Importer une signature (PNG/JPG)
              </Button>
            )}
          </View>
        </View>

        {/* === LANGUE === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.language')}</Text>
          <View style={styles.card}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>
              {t('settings.language.title')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {([{ code: 'fr', flag: '🇫🇷', label: 'Français' }, { code: 'en', flag: '🇬🇧', label: 'English' }] as const).map(({ code, flag, label }) => {
                const isActive = (profile?.language || 'fr') === code;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => handleChangeLanguage(code)}
                    style={[
                      styles.langBtn,
                      isActive && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 22 }}>{flag}</Text>
                    <Text style={[styles.langBtnLabel, isActive && { color: Colors.primary, fontWeight: '700' }]}>
                      {label}
                    </Text>
                    {isActive && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* === À PROPOS === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.about')}</Text>
          <View style={styles.card}>
            <InfoRow label="Factu.me" value={`${t('common.version')} 1.0.0`} />
            <InfoRow label={t('common.compliance')} value="e-invoicing 2026 (Factur-X)" />
            <InfoRow label={t('common.contact')} value="support@factu.me" last />
          </View>
        </View>

        {/* === DÉCONNEXION === */}
        <Button onPress={handleSignOut} variant="danger" fullWidth size="lg" style={{ marginTop: 8 }}>
          {t('settings.danger.logout')}
        </Button>

        {/* === SUPPRESSION COMPTE (RGPD) === */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Supprimer mon compte',
              'Cette action est irréversible. Toutes vos données (factures, clients, profil) seront supprimées définitivement.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer définitivement',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Dernière confirmation',
                      'Confirmez-vous la suppression totale de votre compte Factu.me ?',
                      [
                        { text: 'Non, garder mon compte', style: 'cancel' },
                        {
                          text: 'Oui, supprimer',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteAccount();
                              await supabase.auth.signOut();
                              router.replace('/(auth)/welcome');
                            } catch (err: any) {
                              Alert.alert('Erreur', err.message || 'Impossible de supprimer le compte.');
                            }
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          }}
          style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: Colors.textTertiary, textDecorationLine: 'underline' }}>
            Supprimer mon compte
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>{t('common.madeWith')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[infoStyles.row, !last && infoStyles.border]}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary },
  value: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  pageTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  section: { marginBottom: Spacing.xl, gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  // Profil header
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLogo: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.white },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  profilePlan: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  // Edit trigger
  editTrigger: { paddingTop: 8, marginTop: 4 },
  editTriggerText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  // Edit form
  editForm: { gap: Spacing.md },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  // Logo
  logoSection: { gap: 8 },
  logoRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  logoImage: { width: 64, height: 64 },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Status chips
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  statusChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  statusChipTextActive: { color: Colors.primary, fontWeight: '600' },
  // Plans
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: FontSize.lg, fontWeight: '700' },
  planPrice: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planFeatureDot: { fontSize: 8 },
  planFeatureText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  upgradeBanner: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  upgradeBannerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  upgradeBannerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  upgradeBannerArrow: { fontSize: 22, color: Colors.white },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  langBtnLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  // Template cards
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  templateCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  templateCardName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  templateCardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  lockedBadge: {
    backgroundColor: Colors.gray200,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  lockedBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  customTemplateBox: {
    marginTop: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  // Prefix input
  prefixInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    fontWeight: '700',
    letterSpacing: 1,
    width: 120,
  },
  infoValue: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  hintText: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 17, marginTop: 6 },
  // Color swatches
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  
  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  dropdownItem: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  dropdownSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  dropdownClose: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dropdownCloseText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
