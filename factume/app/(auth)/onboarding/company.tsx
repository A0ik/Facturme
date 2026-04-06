import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '../../../stores/authStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { LegalStatus } from '../../../types';
import { searchEntreprises, fetchBySiret, SireneResult } from '../../../lib/sirene';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const SECTORS = [
  { value: 'batiment', label: 'Bâtiment & Travaux' },
  { value: 'artisan', label: 'Artisan' },
  { value: 'informatique', label: 'Informatique & Tech' },
  { value: 'conseil', label: 'Conseil & Consulting' },
  { value: 'sante', label: 'Santé & Bien-être' },
  { value: 'restauration', label: 'Restauration' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'transport', label: 'Transport & Logistique' },
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'creation', label: 'Création & Design' },
  { value: 'juridique', label: 'Juridique & Comptabilité' },
  { value: 'autre', label: 'Autre' },
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

export default function OnboardingCompany() {
  const router = useRouter();
  const { user, updateProfile, loading } = useAuthStore();

  const [form, setForm] = useState({
    company_name: '',
    siret: '',
    address: '',
    city: '',
    postal_code: '',
    phone: '',
    legal_status: 'auto-entrepreneur' as LegalStatus,
    sector: '',
  });
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Recherche entreprise
  const [searchResults, setSearchResults] = useState<SireneResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  // Debounce la recherche quand on tape le nom
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (form.company_name.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchEntreprises(form.company_name);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 500);
  }, [form.company_name]);

  // Quand on tape un SIRET complet (14 chiffres), on auto-complète
  useEffect(() => {
    const clean = form.siret.replace(/\s/g, '');
    if (clean.length === 14) {
      fetchBySiret(clean).then((result) => {
        if (result) {
          setForm((f) => ({
            ...f,
            company_name: result.nom_complet || f.company_name,
            address: result.adresse || f.address,
            city: result.ville || f.city,
            postal_code: result.code_postal || f.postal_code,
          }));
        }
      }).catch(() => {});
    }
  }, [form.siret]);

  const selectEntreprise = (item: SireneResult) => {
    setForm((f) => ({
      ...f,
      company_name: item.nom_complet,
      siret: item.siret,
      address: item.adresse,
      city: item.ville,
      postal_code: item.code_postal,
    }));
    setShowDropdown(false);
    setSearchResults([]);
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à vos photos pour importer un logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
      setLogoError(false);
    }
  };

  const removeLogo = () => {
    Alert.alert('Supprimer le logo', 'Voulez-vous supprimer le logo ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => setLogoUri(null) },
    ]);
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.company_name.trim()) e.company_name = 'Nom requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;
    try {
      let vatNumber = '';
      if (form.siret && form.legal_status !== 'auto-entrepreneur') {
        const siren = form.siret.slice(0, 9);
        const key = (12 + 3 * (parseInt(siren) % 97)) % 97;
        vatNumber = `FR${String(key).padStart(2, '0')}${siren}`;
      }

      // Upload local logo to Supabase Storage if it's a local file URI
      let finalLogoUrl = logoUri;
      if (logoUri && (logoUri.startsWith('file://') || logoUri.startsWith('content://') || logoUri.startsWith('ph://')) && user?.id) {
        try {
          const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: FileSystem.EncodingType.Base64 });
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const path = `${user.id}/logo.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('logos')
            .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
          finalLogoUrl = urlData.publicUrl;
        } catch (error: any) {
          Alert.alert('Erreur d\'upload', error.message || 'Impossible d\'envoyer le logo');
          return;
        }
      }

      await updateProfile({
        ...form,
        vat_number: vatNumber,
        invoice_prefix:
          form.company_name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || 'FACT',
        logo_url: finalLogoUrl || undefined,
        sector: form.sector || undefined,
      } as any);

      router.push('/(auth)/onboarding/template');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress — step 2/4 */}
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, { backgroundColor: Colors.primary }]} />
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>

          <Text style={styles.step}>Étape 2 / 4</Text>
          <Text style={styles.title}>Votre entreprise</Text>
          <Text style={styles.subtitle}>
            Ces informations apparaîtront sur vos factures.
          </Text>

          <View style={styles.form}>
            {/* Logo */}
            <View>
              <Text style={styles.sectionLabel}>Logo de l'entreprise (facultatif)</Text>
              <View style={styles.logoRow}>
                <TouchableOpacity onPress={pickLogo} style={styles.logoBox} activeOpacity={0.8}>
                  {logoUri && !logoError ? (
                    <Image source={{ uri: logoUri }} style={styles.logoImage} onError={() => setLogoError(true)} />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Ionicons name="business-outline" size={24} color={Colors.textTertiary} />
                      <Text style={styles.logoPlaceholderText}>Importer</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.logoActions}>
                  <Button onPress={pickLogo} variant="outline" size="sm">
                    {logoUri ? 'Changer le logo' : 'Choisir un logo'}
                  </Button>
                  {logoUri && (
                    <Button onPress={removeLogo} variant="ghost" size="sm">
                      Supprimer
                    </Button>
                  )}
                  <Text style={styles.logoHint}>Format carré recommandé (PNG, JPG)</Text>
                </View>
              </View>
            </View>

            {/* Nom entreprise avec recherche */}
            <View style={{ zIndex: 10 }}>
              <Input
                label="Nom de l'entreprise *"
                value={form.company_name}
                onChangeText={(v) => {
                  update('company_name', v);
                }}
                placeholder="Dupont Plomberie, Studio Léa..."
                error={errors.company_name}
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
                    <Text style={styles.dropdownCloseText}>Fermer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Input
              label="SIRET"
              value={form.siret}
              onChangeText={(v) => update('siret', v.replace(/\D/g, ''))}
              placeholder="12345678901234"
              keyboardType="numeric"
              maxLength={14}
              hint="Entrez votre SIRET pour remplir automatiquement les infos"
            />

            <Input
              label="Adresse"
              value={form.address}
              onChangeText={(v) => update('address', v)}
              placeholder="12 rue de la Paix"
            />

            <View style={styles.row}>
              <Input
                label="Code postal"
                value={form.postal_code}
                onChangeText={(v) => update('postal_code', v)}
                placeholder="75001"
                keyboardType="numeric"
                maxLength={5}
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Ville"
                value={form.city}
                onChangeText={(v) => update('city', v)}
                placeholder="Paris"
                containerStyle={{ flex: 2 }}
              />
            </View>

            <Input
              label="Téléphone"
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              placeholder="06 12 34 56 78"
              keyboardType="phone-pad"
            />

            {/* Statut juridique */}
            <View>
              <Text style={styles.sectionLabel}>Statut juridique</Text>
              <View style={styles.statusGrid}>
                {LEGAL_STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => update('legal_status', s.value)}
                    style={[
                      styles.statusChip,
                      form.legal_status === s.value && styles.statusChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        form.legal_status === s.value && styles.statusChipTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Secteur d'activité */}
            <View>
              <Text style={styles.sectionLabel}>Secteur d'activité</Text>
              <View style={styles.statusGrid}>
                {SECTORS.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => update('sector', s.value)}
                    style={[
                      styles.statusChip,
                      form.sector === s.value && styles.statusChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        form.sector === s.value && styles.statusChipTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button onPress={handleContinue} loading={loading} fullWidth size="lg">
              Continuer →
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gray200 },
  progressDone: { backgroundColor: Colors.primary, width: 10 },
  progressActive: { backgroundColor: Colors.primary, width: 24, borderRadius: 5 },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.gray200 },
  step: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '500', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  form: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  // Logo
  logoRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  logoImage: { width: 80, height: 80 },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  logoPlaceholderText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  logoActions: { flex: 1, gap: 8, justifyContent: 'center' },
  logoHint: { fontSize: FontSize.xs, color: Colors.textTertiary },
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
  // Status
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  statusChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  statusChipTextActive: { color: Colors.primary, fontWeight: '600' },
});
