# Journal des corrections — Factu.me

> Sessions du 03/04/2026 — Debug auth + analyse complète de l'app

---

## Session 1 — Bug FK violation à l'inscription

### Contexte

Lors de la création d'un compte, erreur :
```
insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"
```

### Cause racine

Le trigger Supabase `handle_new_user()` (déclenché sur INSERT dans `auth.users`) plantait silencieusement à cause de colonnes manquantes dans la table `profiles` (`language`, `signature_url`, `expo_push_token`). L'exception faisait rollback de l'INSERT dans `auth.users`, donc aucune ligne dans `auth.users` → la FK échouait quand l'app tentait d'insérer dans `profiles`.

### Fix SQL appliqué dans Supabase SQL Editor

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (new.id, new.email, now(), now());
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RETURN new; -- Ne jamais bloquer la création du compte
END;
$$;
```

---

## Session 1 — Bug FK violation à l'onboarding entreprise

### Contexte

Après avoir passé l'inscription, à l'étape "Votre entreprise" (onboarding), nouvelle erreur FK en appelant `updateProfile()`.

### Cause racine (enchaînement)

1. Supabase a **"Confirm email"** activé sur ce projet.
2. `signUp()` retourne `data.user` mais `data.session = null`.
3. L'app faisait `set({ user: data.user })` dans `signUp` → OK.
4. Mais le listener `onAuthStateChange` se déclenchait ensuite avec un event `INITIAL_SESSION` et `session = null`.
5. L'ancienne logique du listener : `else { set({ user: null, profile: null }) }` → **vidait l'utilisateur** juste après que `signUp` l'avait défini.
6. `updateProfile` appelé pendant l'onboarding trouvait `user = null` → "Non authentifié" → échec.

### Fixes appliqués

#### 1. `factume/stores/authStore.ts` — `onAuthStateChange`

**Avant :**
```typescript
} else {
  set({ user: null, profile: null });
}
```

**Après :**
```typescript
} else if (event === 'SIGNED_OUT') {
  set({ user: null, profile: null });
}
// INITIAL_SESSION / TOKEN_REFRESHED sans session = confirmation email en attente
// On ne vide pas l'user pour ne pas casser l'onboarding post-signup
```

#### 2. `factume/stores/authStore.ts` — `signUp`

Détection de l'email de confirmation requis :

```typescript
signUp: async (email, password) => {
  set({ loading: true });
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Erreur lors de la création du compte');
    set({ user: data.user });
    // Si pas de session → confirmation email requise dans Supabase
    if (!data.session) throw new Error('CONFIRM_EMAIL');
    return { userId: data.user.id };
  } finally {
    set({ loading: false });
  }
},
```

#### 3. `factume/app/(auth)/register.tsx` — `handleRegister`

Gestion de l'erreur `CONFIRM_EMAIL` avec alerte et redirection vers login :

```typescript
const handleRegister = async () => {
  if (!validate()) return;
  try {
    await signUp(email.trim(), password);
    router.replace('/(auth)/onboarding/language');
  } catch (err: any) {
    if (err.message === 'CONFIRM_EMAIL') {
      Alert.alert(
        'Confirmez votre email',
        `Un lien de confirmation a été envoyé à ${email.trim()}. Cliquez dessus puis revenez vous connecter.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }
    Alert.alert(
      'Erreur d\'inscription',
      err.message?.includes('already registered')
        ? 'Cet email est déjà utilisé.'
        : err.message
    );
  }
};
```

---

## Session 2 — Analyse complète de l'app + corrections

### Résultat de `npx expo install --check`

```
Dependencies are up to date
```

Tous les packages Expo sont déjà à la version correcte pour SDK 54.

---

### Bug 1 — Upload logo cassé dans l'onboarding entreprise

**Fichier :** `factume/app/(auth)/onboarding/company.tsx`

**Problème :** Upload logo via `fetch(uri).blob()` — cette API est cassée dans React Native pour les URI locaux (`file://`, `content://`, `ph://`). Elle produit un blob avec un mauvais content-type ou vide sur iOS/Android.

`settings.tsx` utilisait déjà le pattern correct (`expo-file-system` + base64 → `Uint8Array`) mais `company.tsx` utilisait encore l'ancienne méthode.

**Fix :**

Ajout de l'import :
```typescript
import * as FileSystem from 'expo-file-system';
```

Remplacement de l'upload :
```typescript
// AVANT (cassé)
const response = await fetch(logoUri);
const blob = await response.blob();
await supabase.storage.from('logos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });

// APRÈS (correct)
const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: FileSystem.EncodingType.Base64 });
const binary = atob(base64);
const bytes = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
const path = `${user.id}/logo.jpg`;
await supabase.storage.from('logos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
```

---

### Bug 2 — `fetchBySiret` sans `.catch()`

**Fichier :** `factume/app/(auth)/onboarding/company.tsx`

**Problème :** Le `useEffect` qui auto-complète depuis le SIRET appelait `fetchBySiret().then(...)` sans `.catch()`. Si l'API SIRENE était indisponible, une exception non gérée se propageait silencieusement.

**Fix :**
```typescript
fetchBySiret(clean).then((result) => {
  if (result) { /* ... */ }
}).catch(() => {}); // Ajout du catch
```

---

### Bug 3 — Import `FlatList` inutilisé

**Fichier :** `factume/app/(auth)/onboarding/company.tsx`

`FlatList` était importé depuis `react-native` mais jamais utilisé dans le composant. Supprimé.

---

### Bug 4 — `supabase.auth.getUser()` dans `dataStore.ts`

**Fichier :** `factume/stores/dataStore.ts`

**Problème :** Les fonctions `createClient`, `createInvoice`, `duplicateInvoice` et `createRecurringInvoice` utilisaient `supabase.auth.getUser()` pour récupérer l'utilisateur courant. Cette méthode fait un **appel réseau** pour vérifier le JWT côté serveur — si le réseau est lent ou indisponible, elle échoue et retourne `null`.

`supabase.auth.getSession()` lit la session depuis **AsyncStorage** (local, synchrone), beaucoup plus fiable dans ce contexte.

**Fix appliqué aux 4 fonctions :**
```typescript
// AVANT
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Non authentifié');

// APRÈS
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
if (!user) throw new Error('Non authentifié');
```

---

### Bug 5 — Import `expo-file-system/legacy` obsolète

**Fichier :** `factume/app/(app)/(tabs)/invoices.tsx`

**Problème :** Import de l'API legacy d'expo-file-system, dépréciée depuis Expo SDK 52.

**Fix :**
```typescript
// AVANT
import * as FileSystem from 'expo-file-system/legacy';

// APRÈS
import * as FileSystem from 'expo-file-system';
```

---

## Récapitulatif de tous les fichiers modifiés

| Fichier | Modification |
|---|---|
| `factume/stores/authStore.ts` | `onAuthStateChange` ne vide l'user que sur `SIGNED_OUT` |
| `factume/stores/authStore.ts` | `signUp` détecte `data.session === null` → lance `CONFIRM_EMAIL` |
| `factume/stores/dataStore.ts` | `createClient`, `createInvoice`, `duplicateInvoice`, `createRecurringInvoice` → `getSession()` à la place de `getUser()` |
| `factume/app/(auth)/register.tsx` | `handleRegister` gère l'erreur `CONFIRM_EMAIL` |
| `factume/app/(auth)/onboarding/company.tsx` | Upload logo → `FileSystem` + `Uint8Array` |
| `factume/app/(auth)/onboarding/company.tsx` | `fetchBySiret` → `.catch(() => {})` |
| `factume/app/(auth)/onboarding/company.tsx` | Import `FlatList` supprimé |
| `factume/app/(app)/(tabs)/invoices.tsx` | Import `expo-file-system/legacy` → `expo-file-system` |

---

## Note sur la config Supabase

Si l'option **"Confirm email"** est désactivée dans le Dashboard Supabase (Authentication → Providers → Email), `data.session` sera toujours rempli après `signUp` et le flow sera plus simple (pas d'email de confirmation, redirection directe vers l'onboarding). Le code actuel gère les deux cas.
