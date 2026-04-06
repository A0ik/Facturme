import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="invoice/new"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="invoice/[id]" />
      <Stack.Screen name="client/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="client/[id]" />
      <Stack.Screen name="recurring/index" />
      <Stack.Screen
        name="recurring/new"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
