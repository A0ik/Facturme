import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function Index() {
  const { user, profile } = useAuthStore();

  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (!profile?.onboarding_done) return <Redirect href="/(auth)/onboarding/language" />;
  return <Redirect href="/(app)/(tabs)/" />;
}
