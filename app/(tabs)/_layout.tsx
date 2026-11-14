import { Tabs } from 'expo-router';
import { CalendarRange, Cloud, Dumbbell, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerNativeHaptic } from '@/modules/treino-native';
import { useThemePreference } from '@/store/useWorkoutStore';

export default function TabLayout() {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  const bg = isDark ? '#09090b' : '#ffffff';
  const border = isDark ? '#27272a' : '#e4e4e7';
  const active = isDark ? '#fafafa' : '#18181b';
  const inactive = isDark ? '#71717a' : '#a1a1aa';

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          triggerNativeHaptic('tap');
        },
      }}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        lazy: true,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          borderTopWidth: 1,
          height: 58 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Treino',
          tabBarIcon: ({ color, size }) => <Dumbbell size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rotina"
        options={{
          title: 'Rotina',
          tabBarIcon: ({ color, size }) => <CalendarRange size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="evolucao"
        options={{
          title: 'Evolução',
          tabBarIcon: ({ color, size }) => <TrendingUp size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: 'Backup',
          tabBarIcon: ({ color, size }) => <Cloud size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
