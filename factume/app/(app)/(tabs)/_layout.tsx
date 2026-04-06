import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { useTranslation } from 'react-i18next';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
    index: { active: 'home', inactive: 'home-outline' },
    invoices: { active: 'document-text', inactive: 'document-text-outline' },
    clients: { active: 'people', inactive: 'people-outline' },
    crm: { active: 'trending-up', inactive: 'trending-up-outline' },
    settings: { active: 'settings', inactive: 'settings-outline' },
  };
  const iconSet = icons[name] || { active: 'ellipse', inactive: 'ellipse-outline' };
  return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={22} color={color} />;
}

export default function TabsLayout() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('common.home'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="index" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: t('common.invoices'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="invoices" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t('common.clients'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="clients" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: 'CRM',
          tabBarIcon: ({ focused, color }) => <TabIcon name="crm" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common.settings'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="settings" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 84,
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
