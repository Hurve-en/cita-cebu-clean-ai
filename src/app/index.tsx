import { useAuth } from "@/features/auth/auth-state";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useResident } from "@/features/resident/resident-state";
import {
  Button,
  Card,
  Copy,
  Heading,
  Icon,
  Page,
  palette,
  ui,
} from "@/features/resident/resident-ui";
const slides = [
  {
    title: "A cleaner Cebu starts with us.",
    label: "SMALL HABITS. SHARED IMPACT.",
    heading: "Give every item a better next step.",
    description:
      "Sort with care, stay informed, and help keep your neighborhood clean.",
    icon: "leaf" as const,
  },
  {
    title: "Less guessing. Better sorting.",
    label: "YOUR EVERYDAY SORTING GUIDE",
    heading: "Point. Scan. Check.",
    description:
      "Take a clear photo for a material suggestion. Always check local disposal rules before sorting.",
    icon: "scan" as const,
  },
  {
    title: "Feel closer to your community.",
    label: "BE PART OF SOMETHING CLEANER",
    heading: "Know what happens around you.",
    description:
      "Find collection information and report waste concerns from one place.",
    icon: "home" as const,
  },
];
export default function WelcomeScreen() {
  const { state } = useResident();
  const auth = useAuth();
  const [step, setStep] = useState(0);
  if (auth.state.user) return <Redirect href="/workspace" />;
  if (auth.state.phase === "loading") return <Page title="Opening CebuCleanAI" badge="Account access"><Copy>Checking your session…</Copy></Page>;
  if (state.profile) return <Redirect href="/(tabs)/home" />;
  const slide = slides[step];
  return (
    <Page
      badge="Welcome"
      title={slide.title}
      subtitle="Simple tools for more responsible waste habits."
    >
      <View
        style={[
          ui.hero,
          { alignItems: "center", paddingVertical: 40, gap: 22 },
        ]}
      >
        <Text style={[ui.eyebrow, { textAlign: "center" }]}>{slide.label}</Text>
        <View
          style={{
            width: 124,
            height: 124,
            borderRadius: 44,
            backgroundColor: palette.lime,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 10,
            borderColor: "#387558",
          }}
        >
          <Icon name={slide.icon} size={52} />
        </View>
        <Text style={[ui.heroTitle, { textAlign: "center", fontSize: 25 }]}>
          {slide.heading}
        </Text>
        <Text style={[ui.heroCopy, { textAlign: "center" }]}>
          {slide.description}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignSelf: "center", gap: 6 }}>
        {slides.map((_, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`Introduction ${index + 1} of 3`}
            accessibilityState={{ selected: step === index }}
            onPress={() => setStep(index)}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                height: 6,
                width: step === index ? 28 : 8,
                borderRadius: 3,
                backgroundColor: step === index ? palette.green : "#C4D0C5",
              }}
            />
          </Pressable>
        ))}
      </View>
      <Button
        label={step < 2 ? "Next" : "Create an account"}
        onPress={() =>
          step < 2
            ? setStep(step + 1)
            : router.push({
                pathname: "/account",
                params: { mode: "register" },
              })
        }
      />
      <Button
        secondary
        label="I already have an account"
        onPress={() =>
          router.push({ pathname: "/account", params: { mode: "login" } })
        }
      />
      <Card>
        <Heading>Your community account</Heading>
        <Copy>
          Create an account or sign in to manage your account. Community workflows are being connected in stages.
        </Copy>
      </Card>
    </Page>
  );
}
