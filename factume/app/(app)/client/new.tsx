import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../../stores/dataStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { searchEntreprises, fetchBySiret, SireneResult } from '../../../lib/sirene';

export default function NewClient() {
  const router = useRouter();
  const { createClient } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    siret: '',
    address: '',
    city: '',
    postal_code: '',
    vat_number: '',
    notes: '',
    country: 'France',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Nom requis';
    if (form.email && !form.email.includes('@')) e.email = 'Email invalide';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ----- Recherche Sirene -----
  const [searchResults, setSearchResults] = useState<SireneResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (form.name.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchEntreprises(form.name);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 500);
  }, [form.name]);

  React.useEffect(() => {
    const clean = form.siret.replace(/\s/g, '');
    if (clean.length === 14) {
      fetchBySiret(clean).then((result) => {
        if (result) {
          setForm((f) => ({
            ...f,
            name: result.nom_complet || f.name,
            address: result.adresse || f.address,
            city: result.ville || f.city,
            postal_code: result.code_postal || f.postal_code,
          }));
        }
      });
    }
  }, [form.siret]);

  const selectEntreprise = (item: SireneResult) => {
    let vatNumber = '';
    if (item.siret) {
      const siren = item.siret.slice(0, 9);
      const key = (12 + 3 * (parseInt(siren) % 97)) % 97;
      vatNumber = `FR${String(key).padStart(2, '0')}${siren}`;
    }

    setForm((f) => ({
      ...f,
      name: item.nom_complet,
      siret: item.siret || '',
      address: item.adresse || '',
      city: item.ville || '',
      postal_code: item.code_postal || '',
      vat_number: vatNumber,
    }));
    setShowDropdown(false);
    setSearchResults([]);
  };
  // -----------------------------

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await createClient(form);
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau client</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ zIndex: 10 }}>
            <Input label="Nom *" value={form.name} onChangeText={(v) => update('name', v)}
              placeholder="Dupont Plomberie, Restaurant Le Marais..." error={errors.name} 
              rightIcon={searching ? <ActivityIndicator size="small" color={Colors.primary} /> : undefined} />
            
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

          <Input label="Email" value={form.email} onChangeText={(v) => update('email', v)}
            placeholder="contact@entreprise.fr" keyboardType="email-address"
            autoCapitalize="none" error={errors.email} />

          <Input label="Téléphone" value={form.phone} onChangeText={(v) => update('phone', v)}
            placeholder="06 12 34 56 78" keyboardType="phone-pad" />

          <Input label="SIRET" value={form.siret} onChangeText={(v) => update('siret', v.replace(/\D/g, ''))}
            placeholder="123 456 789 01234" keyboardType="numeric" maxLength={14} />

          <Input label="N° TVA intracommunautaire" value={form.vat_number}
            onChangeText={(v) => update('vat_number', v)} placeholder="FR12345678901" />

          <Input label="Adresse" value={form.address} onChangeText={(v) => update('address', v)}
            placeholder="12 rue de la Paix" />

          <View style={styles.row}>
            <Input label="Code postal" value={form.postal_code}
              onChangeText={(v) => update('postal_code', v)} placeholder="75001"
              keyboardType="numeric" maxLength={5} containerStyle={{ flex: 1 }} />
            <Input label="Ville" value={form.city} onChangeText={(v) => update('city', v)}
              placeholder="Paris" containerStyle={{ flex: 2 }} />
          </View>

          <Input label="Notes" value={form.notes} onChangeText={(v) => update('notes', v)}
            placeholder="Notes internes sur ce client..." multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }} />

          <Button onPress={handleSave} loading={loading} fullWidth size="lg" style={{ marginTop: Spacing.md }}>
            Créer le client
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: Colors.gray100 },
  closeText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },

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
