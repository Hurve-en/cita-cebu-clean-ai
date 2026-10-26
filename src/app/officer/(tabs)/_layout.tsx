import { Tabs } from "expo-router";
import { Icon, palette } from "@/features/resident/resident-ui";
export default function OfficerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.green,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
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
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ focused }) => (
            <Icon
              name="report"
              color={focused ? palette.green : palette.muted}
            />
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
