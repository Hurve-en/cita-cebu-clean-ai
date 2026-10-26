import type { ConfigContext, ExpoConfig } from "expo/config";

export default function ({ config }: ConfigContext): ExpoConfig {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    ...(config.plugins ?? []).filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;

      return name !== "expo-splash-screen";
    }),
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F6F7F3",
        image: "./assets/images/branding/logo.png",
        imageWidth: 120,
        resizeMode: "contain",
      },
    ],
  ];

  return {
    ...config,

    name: config.name ?? "CebuCleanAI",
    slug: config.slug ?? "CebuCleanAI",

    icon: "./assets/images/branding/app-icon.png",

    ios: {
      ...config.ios,
      icon: "./assets/images/branding/app-icon.png",
    },

    android: {
      ...config.android,
      icon: "./assets/images/branding/app-icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/branding/adaptive-icon.png",
        backgroundColor: "#F6F7F3",
      },
    },

    web: {
      ...config.web,
      favicon: "./assets/images/branding/app-icon.png",
    },

    plugins,
  };
}
