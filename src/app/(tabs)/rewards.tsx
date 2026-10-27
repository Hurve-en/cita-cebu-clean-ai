import { useAuth } from "@/features/auth/auth-state";
import { LiveRewards } from "@/features/resident/live-ui";
import { Text, View } from "react-native";
import { REWARDS, useResident } from "@/features/resident/resident-state";
import {
  Card,
  Copy,
  Heading,
  Icon,
  MenuItem,
  openDetail,
  Page,
  Section,
  ui,
} from "@/features/resident/resident-ui";
function DemoRewardsScreen() {
  const { state } = useResident();
  return (
    <Page
      title="A little extra motivation"
      subtitle="Explore rewards for greener habits."
    >
      <View style={ui.hero}>
        <View style={ui.row}>
          <Text style={ui.eyebrow}>YOUR DEMO BALANCE</Text>
          <Icon name="gift" color="#DEEDB8" />
        </View>
        <Text style={[ui.points, { color: "white" }]}>
          {state.points} <Text style={{ fontSize: 18 }}>pts</Text>
        </Text>
        <Text style={ui.heroCopy}>
          Sample points to explore this preview. No real rewards or earning
          program are connected.
        </Text>
      </View>
      <Section
        title="Reward catalog"
        action="History"
        onPress={() => openDetail("redemptions")}
      />
      {REWARDS.map((reward, index) => (
        <Card key={reward.id} onPress={() => openDetail("reward", reward.id)}>
          <View style={ui.row}>
            <View style={ui.iconTile}>
              <Icon name={index === 0 ? "leaf" : "gift"} />
            </View>
            <Text style={ui.badge}>{reward.cost} pts</Text>
          </View>
          <Heading>{reward.name}</Heading>
          <Copy>{reward.description}</Copy>
          <Text style={ui.link}>
            {state.points >= reward.cost
              ? "View demo reward →"
              : `${reward.cost - state.points} more demo points needed`}
          </Text>
        </Card>
      ))}
      <MenuItem
        icon="help"
        title="How points work"
        detail="Scans do not earn points or verify disposal"
        onPress={() => openDetail("help")}
      />
    </Page>
  );
}

export default function RewardsScreen() {
  const { state } = useAuth();
  return state.user ? <LiveRewards /> : <DemoRewardsScreen />;
}
