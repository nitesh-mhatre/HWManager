import { Tabs } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ icon, iconLib, focused }: { icon: string; iconLib: 'material' | 'materialCommunity'; focused: boolean }) {
  const color = focused ? '#e63946' : '#555';
  const size = 24;

  if (iconLib === 'materialCommunity') {
    return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
  }
  return <MaterialIcons name={icon as any} size={size} color={color} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f0f23',
          borderTopColor: '#222',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#e63946',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="garage"
        options={{
          title: 'Garage',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="car" iconLib="materialCommunity" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="star" iconLib="material" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="barcode-scan" iconLib="materialCommunity" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="add-circle" iconLib="material" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="settings" iconLib="material" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
