import { useDemo } from "@/features/auth/demo-state";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Button,
  Card,
  Copy,
  EmptyState,
  Field,
  Heading,
  Icon,
  Message,
  Page,
  palette,
} from "@/features/resident/resident-ui";

type Section = "overview" | "officers" | "barangays" | "account";
type Filter = "all" | "active" | "inactive";
type OfficerStatus = "active" | "inactive";

type Barangay = {
  id: string;
  name: string;
  district: string;
};

type Officer = {
  id: string;
  name: string;
  email: string;
  barangayId: string;
  status: OfficerStatus;
};

type OfficerForm = {
  id?: string;
  name: string;
  email: string;
  barangayId: string;
};

type Activity = {
  id: string;
  description: string;
  time: string;
};

const BARANGAYS: Barangay[] = [
  { id: "demo-north", name: "Sample North", district: "Demo district A" },
  { id: "demo-central", name: "Sample Central", district: "Demo district A" },
  { id: "demo-south", name: "Sample South", district: "Demo district B" },
];

const INITIAL_OFFICERS: Officer[] = [
  {
    id: "sample-officer-1",
    name: "Alex Santos",
    email: "alex@example.com",
    barangayId: "demo-north",
    status: "active",
  },
  {
    id: "sample-officer-2",
    name: "Jamie Cruz",
    email: "jamie@example.com",
    barangayId: "demo-central",
    status: "active",
  },
  {
    id: "sample-officer-3",
    name: "Taylor Reyes",
    email: "taylor@example.com",
    barangayId: "demo-south",
    status: "inactive",
  },
];

const NAV_ITEMS: {
  key: Section;
  label: string;
  icon: "home" | "person" | "pin" | "settings";
}[] = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "officers", label: "Officers", icon: "person" },
  { key: "barangays", label: "Barangays", icon: "pin" },
  { key: "account", label: "Account", icon: "settings" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function barangayName(id: string) {
  return BARANGAYS.find((item) => item.id === id)?.name ?? "Unassigned";
}

function Status({ active }: { active: boolean }) {
  return (
    <View style={[styles.badge, !active && styles.inactiveBadge]}>
      <Text style={[styles.badgeText, !active && styles.inactiveText]}>
        {active ? "Active" : "Inactive"}
      </Text>
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceSelectedText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Metric({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. View details`}
      onPress={onPress}
      style={({ pressed }) => [styles.metric, pressed && styles.pressed]}
    >
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Pressable>
  );
}

export default function AdminScreen() {
  const demo = useDemo();
  const [section, setSection] = useState<Section>("overview");
  const [officers, setOfficers] = useState<Officer[]>(() =>
    INITIAL_OFFICERS.map((item) => ({ ...item })),
  );
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [barangayFilter, setBarangayFilter] = useState<string | null>(null);
  const [form, setForm] = useState<OfficerForm | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCount = officers.filter(
    (item) => item.status === "active",
  ).length;

  const uncoveredBarangays = BARANGAYS.filter(
    (barangay) =>
      !officers.some(
        (officer) =>
          officer.barangayId === barangay.id && officer.status === "active",
      ),
  );

  const query = search.trim().toLowerCase();

  const visibleOfficers = officers.filter((officer) => {
    const matchesStatus = filter === "all" || officer.status === filter;
    const matchesBarangay =
      !barangayFilter || officer.barangayId === barangayFilter;
    const matchesSearch =
      !query ||
      [officer.name, officer.email, barangayName(officer.barangayId)].some(
        (value) => value.toLowerCase().includes(query),
      );

    return matchesStatus && matchesBarangay && matchesSearch;
  });

  function recordActivity(description: string) {
    setActivities((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...current.slice(0, 19),
    ]);
  }

  function navigate(next: Section) {
    setSection(next);
    setForm(null);
    setError("");
    setNotice("");
  }

  function showOfficers(
    nextFilter: Filter = "all",
    nextBarangay: string | null = null,
  ) {
    navigate("officers");
    setFilter(nextFilter);
    setBarangayFilter(nextBarangay);
    setSearch("");
  }

  function openForm(officer?: Officer, assignedBarangay?: string) {
    setError("");
    setNotice("");

    setForm(
      officer
        ? {
            id: officer.id,
            name: officer.name,
            email: officer.email,
            barangayId: officer.barangayId,
          }
        : {
            name: "",
            email: "",
            barangayId: assignedBarangay ?? "",
          },
    );
  }

  function updateForm(patch: Partial<OfficerForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setError("");
  }

  function saveOfficer() {
    if (!form) return;

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (name.length < 2 || name.length > 80) {
      setError("Enter a name between 2 and 80 characters.");
      return;
    }

    if (!EMAIL.test(email) || email.length > 254) {
      setError("Enter a valid email address.");
      return;
    }

    if (!BARANGAYS.some((item) => item.id === form.barangayId)) {
      setError("Choose a barangay assignment.");
      return;
    }

    if (
      officers.some(
        (item) => item.id !== form.id && item.email.toLowerCase() === email,
      )
    ) {
      setError("An officer with this email already exists.");
      return;
    }

    const existing = form.id
      ? officers.find((item) => item.id === form.id)
      : undefined;

    if (form.id && !existing) {
      setError("This officer is no longer available. Close this form.");
      return;
    }

    const saved: Officer = {
      id:
        existing?.id ??
        `officer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      email,
      barangayId: form.barangayId,
      status: existing?.status ?? "active",
    };

    setOfficers((current) =>
      existing
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );

    recordActivity(
      `${existing ? "Updated" : "Added"} ${name} · ${barangayName(
        saved.barangayId,
      )}`,
    );

    setForm(null);
    setError("");
    setNotice(
      existing
        ? "Officer details updated in this preview."
        : "Sample officer added. No account or invitation was created.",
    );
  }

  function changeStatus(officer: Officer) {
    const activating = officer.status === "inactive";

    Alert.alert(
      activating ? "Activate officer?" : "Deactivate officer?",
      activating
        ? `${officer.name} will appear as active in this preview.`
        : `${officer.name} will appear as inactive. Their assignment will be retained.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: activating ? "Activate" : "Deactivate",
          style: activating ? "default" : "destructive",
          onPress: () => {
            setOfficers((current) =>
              current.map((item) =>
                item.id === officer.id
                  ? {
                      ...item,
                      status: activating ? "active" : "inactive",
                    }
                  : item,
              ),
            );

            recordActivity(
              `${activating ? "Activated" : "Deactivated"} ${officer.name}`,
            );

            setNotice(
              `${officer.name} is now ${
                activating ? "active" : "inactive"
              } in this preview.`,
            );
          },
        },
      ],
    );
  }

  function exitPreview() {
    Alert.alert(
      "Leave the admin preview?",
      "Sample changes will reset when you open it again.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave preview",
          onPress: () => { demo.end(); router.replace("/account"); },
        },
      ],
    );
  }

  const editing = form !== null;

  return (
    <Page
      title={
        editing
          ? form.id
            ? "Edit officer"
            : "Add officer"
          : section === "overview"
            ? "Community overview"
            : section === "officers"
              ? "Manage officers"
              : section === "barangays"
                ? "Barangay coverage"
                : "Admin account"
      }
      subtitle="CebuCleanAI · Admin workspace"
    >
      <View style={styles.preview}>
        <Icon name="settings" size={18} color={palette.green} />
        <Text style={styles.previewText}>
          Development preview · Sample data · Changes reset on exit
        </Text>
      </View>

      {!editing && (
        <View style={styles.navigation}>
          {NAV_ITEMS.map((item) => {
            const selected = section === item.key;

            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => navigate(item.key)}
                style={({ pressed }) => [
                  styles.navItem,
                  selected && styles.navSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  color={selected ? palette.green : palette.muted}
                />
                <Text
                  style={[styles.navLabel, selected && styles.navLabelSelected]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Message text={notice} />

      {editing ? (
        <>
          <Card>
            <Heading>Officer details</Heading>
            <Copy>
              Assign one barangay to this sample officer. Creating a demo record
              does not create a login account.
            </Copy>
          </Card>

          <Field
            label="Full name"
            placeholder="Officer name"
            value={form.name}
            onChangeText={(name) => updateForm({ name })}
            autoComplete="name"
            maxLength={80}
          />

          <Field
            label="Email address"
            placeholder="officer@example.com"
            value={form.email}
            onChangeText={(email) => updateForm({ email })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
          />

          <Heading>Barangay assignment</Heading>
          <Copy>Choose the community this officer will oversee.</Copy>

          <View style={styles.choices}>
            {BARANGAYS.map((barangay) => (
              <Choice
                key={barangay.id}
                label={barangay.name}
                selected={form.barangayId === barangay.id}
                onPress={() => updateForm({ barangayId: barangay.id })}
              />
            ))}
          </View>

          <Message error text={error} />
          <Button
            label={form.id ? "Save officer changes" : "Add sample officer"}
            onPress={saveOfficer}
          />
          <Button
            secondary
            label="Cancel"
            onPress={() => {
              setForm(null);
              setError("");
            }}
          />
        </>
      ) : section === "overview" ? (
        <>
          <Card>
            <Text style={styles.eyebrow}>ADMIN OVERVIEW</Text>
            <Heading>Keep every community supported.</Heading>
            <Copy>
              Review officer coverage and keep assignments up to date.
            </Copy>
          </Card>

          <View style={styles.metrics}>
            <Metric
              label="Active officers"
              value={activeCount}
              onPress={() => showOfficers("active")}
            />
            <Metric
              label="Inactive officers"
              value={officers.length - activeCount}
              onPress={() => showOfficers("inactive")}
            />
            <Metric
              label="Barangays"
              value={BARANGAYS.length}
              onPress={() => navigate("barangays")}
            />
            <Metric
              label="Need coverage"
              value={uncoveredBarangays.length}
              onPress={() => navigate("barangays")}
            />
          </View>

          <Heading>Needs attention</Heading>

          {uncoveredBarangays.length ? (
            uncoveredBarangays.map((barangay) => (
              <Card key={barangay.id}>
                <Text style={styles.attention}>No active officer</Text>
                <Heading>{barangay.name}</Heading>
                <Copy>
                  Review existing officers or add an officer for this community.
                </Copy>
                <Button
                  secondary
                  label="Review assignment"
                  onPress={() => showOfficers("all", barangay.id)}
                />
              </Card>
            ))
          ) : (
            <Card>
              <Heading>Every barangay has coverage</Heading>
              <Copy>
                All sample communities have at least one active officer.
              </Copy>
            </Card>
          )}

          <Button
            label="Add an officer"
            onPress={() => {
              navigate("officers");
              openForm();
            }}
          />

          <Heading>Activity this session</Heading>

          {activities.length ? (
            activities.slice(0, 5).map((activity) => (
              <Card key={activity.id}>
                <Text style={styles.body}>{activity.description}</Text>
                <Copy>{activity.time} · Demo admin</Copy>
              </Card>
            ))
          ) : (
            <Copy>Officer changes will appear here during this preview.</Copy>
          )}
        </>
      ) : section === "officers" ? (
        <>
          <Copy>
            Manage sample officer records and their community assignments.
          </Copy>

          <Button label="Add officer" onPress={() => openForm()} />

          <Field
            label="Search officers"
            placeholder="Name, email, or barangay"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />

          <View style={styles.choices}>
            {(["all", "active", "inactive"] as const).map((item) => (
              <Choice
                key={item}
                label={
                  item === "all"
                    ? "All officers"
                    : item === "active"
                      ? "Active"
                      : "Inactive"
                }
                selected={filter === item}
                onPress={() => setFilter(item)}
              />
            ))}
          </View>

          {barangayFilter && (
            <Card>
              <Copy>Showing {barangayName(barangayFilter)}</Copy>
              <Button
                secondary
                label="Show all barangays"
                onPress={() => setBarangayFilter(null)}
              />
            </Card>
          )}

          <Copy>
            {visibleOfficers.length}{" "}
            {visibleOfficers.length === 1 ? "officer" : "officers"} found
          </Copy>

          {visibleOfficers.length ? (
            visibleOfficers.map((officer) => (
              <Card key={officer.id}>
                <View style={styles.officerHeader}>
                  <View style={styles.avatar}>
                    <Icon name="person" size={24} color={palette.green} />
                  </View>
                  <View style={styles.officerIdentity}>
                    <Heading>{officer.name}</Heading>
                    <Text selectable style={styles.email}>
                      {officer.email}
                    </Text>
                  </View>
                </View>

                <Status active={officer.status === "active"} />
                <Copy>{barangayName(officer.barangayId)}</Copy>

                <Button
                  secondary
                  label="Edit details and assignment"
                  onPress={() => openForm(officer)}
                />
                <Button
                  secondary
                  label={
                    officer.status === "active"
                      ? "Deactivate officer"
                      : "Activate officer"
                  }
                  onPress={() => changeStatus(officer)}
                />
              </Card>
            ))
          ) : (
            <>
              <EmptyState
                icon="person"
                title="No matching officers"
                description="Try another search or clear the current filters."
              />
              <Button
                secondary
                label="Clear search and filters"
                onPress={() => {
                  setSearch("");
                  setFilter("all");
                  setBarangayFilter(null);
                }}
              />
            </>
          )}
        </>
      ) : section === "barangays" ? (
        <>
          <Copy>
            Coverage means a community has at least one active sample officer.
          </Copy>

          {BARANGAYS.map((barangay) => {
            const assigned = officers.filter(
              (item) => item.barangayId === barangay.id,
            );
            const active = assigned.filter((item) => item.status === "active");

            return (
              <Card key={barangay.id}>
                <Text style={styles.eyebrow}>{barangay.district}</Text>
                <Heading>{barangay.name}</Heading>
                <Text style={active.length ? styles.covered : styles.attention}>
                  {active.length
                    ? `${active.length} active ${
                        active.length === 1 ? "officer" : "officers"
                      }`
                    : "Needs an active officer"}
                </Text>

                <Copy>
                  {assigned.length
                    ? assigned.map((item) => item.name).join(", ")
                    : "No officers assigned yet."}
                </Copy>

                <Button
                  secondary
                  label="View assigned officers"
                  onPress={() => showOfficers("all", barangay.id)}
                />
                <Button
                  secondary
                  label="Add officer here"
                  onPress={() => {
                    navigate("officers");
                    openForm(undefined, barangay.id);
                  }}
                />
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <Card>
            <View style={styles.avatar}>
              <Icon name="settings" size={26} color={palette.green} />
            </View>
            <Heading>Demo administrator</Heading>
            <Copy>admin@example.com</Copy>
            <Text style={styles.covered}>Admin preview</Text>
          </Card>

          <Card>
            <Heading>Workspace access</Heading>
            <Copy>
              This preview demonstrates officer records and barangay
              assignments. It does not grant access to real accounts.
            </Copy>
          </Card>

          <Card>
            <Heading>Account provisioning</Heading>
            <Copy>
              Real officer invitations, role enforcement, and account access
              will be connected during backend implementation.
            </Copy>
          </Card>

          <Button secondary label="Leave admin preview" onPress={exitPreview} />
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EAF2EC",
  },
  previewText: {
    flex: 1,
    color: "#185D43",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  navigation: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  navItem: {
    flexGrow: 1,
    flexBasis: "42%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    backgroundColor: "#FFFFFF",
  },
  navSelected: {
    backgroundColor: "#EAF2EC",
    borderColor: "#185D43",
  },
  navLabel: {
    color: "#5D6E65",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  navLabelSelected: {
    color: "#185D43",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    flexBasis: "44%",
    flexGrow: 1,
    minHeight: 112,
    justifyContent: "center",
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 20,
    gap: 6,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#185D43",
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5D6E65",
  },
  eyebrow: {
    color: "#5D6E65",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5DE",
  },
  choiceSelected: {
    backgroundColor: "#185D43",
    borderColor: "#185D43",
  },
  choiceText: {
    color: "#5D6E65",
    fontSize: 13,
    fontWeight: "600",
  },
  choiceSelectedText: {
    color: "#FFFFFF",
  },
  officerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  officerIdentity: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EAF2EC",
    alignItems: "center",
    justifyContent: "center",
  },
  email: {
    fontSize: 13,
    lineHeight: 20,
    color: "#5D6E65",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EAF2EC",
  },
  inactiveBadge: {
    backgroundColor: "#F1F2F0",
  },
  badgeText: {
    color: "#185D43",
    fontSize: 12,
    fontWeight: "700",
  },
  inactiveText: {
    color: "#5D6E65",
  },
  body: {
    color: "#192F26",
    fontSize: 14,
    lineHeight: 22,
  },
  covered: {
    color: "#185D43",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  attention: {
    color: "#80551E",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
