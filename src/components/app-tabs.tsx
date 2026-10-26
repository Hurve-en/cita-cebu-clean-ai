import { Tabs } from "expo-router";

import { Icon, palette } from "@/features/resident/resident-ui";

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.green,
        tabBarInactiveTintColor: palette.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: palette.white,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <Icon name="home" color={focused ? palette.green : palette.muted} />
          ),
        }}
      />

      <Tabs.Screen
        name="schedules"
        options={{
          title: "Schedules",
          tabBarIcon: ({ focused }) => (
            <Icon
              name="calendar"
              color={focused ? palette.green : palette.muted}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ focused }) => (
            <Icon
              name="scan"
              color={focused ? palette.green : palette.muted}
              size={26}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="rewards"
        options={{
          title: "Rewards",
          tabBarIcon: ({ focused }) => (
            <Icon name="gift" color={focused ? palette.green : palette.muted} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <Icon
              name="person"
              color={focused ? palette.green : palette.muted}
            />
          ),
        }}
      />
    </Tabs>
  );
}
