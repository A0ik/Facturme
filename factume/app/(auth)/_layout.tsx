import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboarding/language" />
      <Stack.Screen name="onboarding/company" />
      <Stack.Screen name="onboarding/template" />
      <Stack.Screen name="onboarding/first-client" />
      <Stack.Screen name="onboarding/done" />
    </Stack>
  );
}
