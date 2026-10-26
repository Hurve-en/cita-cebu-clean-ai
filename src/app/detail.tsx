import { Redirect, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { SavedPhoto } from "@/features/resident/saved-photo";
import { MATERIAL_NAMES } from "@/features/resident/resident-model";
import { Switch, View } from "react-native";

import {
  CATEGORY_GUIDANCE,
  SAMPLE_SCHEDULES,
} from "@/features/resident/resident-data";
import { REWARDS, useResident } from "@/features/resident/resident-state";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Message,
  openDetail,
  Page,
  ui,
} from "@/features/resident/resident-ui";

export default function DetailScreen() {
  const params = useLocalSearchParams<{
    view?: string;
    id?: string;
  }>();

  const view = typeof params.view === "string" ? params.view : "";
  const id = typeof params.id === "string" ? params.id : "";

  return <DetailContent key={`${view}:${id}`} view={view} id={id} />;
}

function DetailContent({ view, id }: { view: string; id: string }) {
  const { state, dispatch, saveReport, removeScan, removeReport } =
    useResident();

  const [name, setName] = useState(state.profile?.name ?? "");
  const [barangay, setBarangay] = useState(state.profile?.barangay ?? "");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const busy = useRef(false);

  if (!state.profile) {
    return <Redirect href="/" />;
  }

  const profile = state.profile;

  if (view === "category") {
    return (
      <Page title={id || "Waste guidance"} back>
        <Card>
          <Heading>Before you dispose</Heading>

          <Copy>
            {CATEGORY_GUIDANCE[id] || "This category is not available."}
          </Copy>

          <Copy>
            General guidance only. Follow your barangay&apos;s current rules.
            Hazardous waste requires special handling.
          </Copy>
        </Card>
      </Page>
    );
  }

  if (view === "schedule") {
    const schedule = SAMPLE_SCHEDULES.find((item) => item.id === id);

    return (
      <Page title={schedule?.title || "Schedule unavailable"} back>
        {schedule ? (
          <Card>
            <Heading>{schedule.day}</Heading>
            <Copy>{schedule.time}</Copy>
            <Copy>{schedule.instruction}</Copy>

            <Copy>
              Fictional sample only. This is not an official collection
              schedule.
            </Copy>
          </Card>
        ) : (
          <Copy>This sample schedule could not be found.</Copy>
        )}
      </Page>
    );
  }

  if (view === "edit-profile" || view === "barangay") {
    function saveProfile() {
      setError("");
      setMessage("");

      if (!name.trim() || !barangay.trim()) {
        setError("Name and barangay are required.");
        return;
      }

      dispatch({
        type: "profile",
        profile: {
          ...profile,
          name: name.trim(),
          barangay: barangay.trim(),
        },
      });

      setMessage("Demo profile updated for this session.");
    }

    return (
      <Page title={view === "barangay" ? "Your barangay" : "Edit profile"} back>
        {view === "edit-profile" && (
          <Field label="Full name" value={name} onChangeText={setName} />
        )}

        <Field
          label="Barangay"
          value={barangay}
          onChangeText={setBarangay}
          placeholder="Enter your barangay"
        />

        <Copy>
          Free-text selection for this preview. Official barangay choices and
          service coverage will come from the backend.
        </Copy>

        <Message error text={error} />
        <Message text={message} />

        <Button label="Save demo profile" onPress={saveProfile} />
      </Page>
    );
  }

  if (view === "new-report") {
    async function chooseAttachment() {
      if (busy.current) return;
      busy.current = true;
      setPicking(true);
      setError("");
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          allowsEditing: false,
          quality: 0.8,
          exif: false,
          base64: false,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.uri) throw new Error("No image returned.");
        if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024)
          throw new Error("Choose a photo smaller than 20 MB.");
        setPhotoReady(false);
        setAttachment(asset.uri);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not open the photo library.",
        );
      } finally {
        busy.current = false;
        setPicking(false);
      }
    }
    async function submitReport() {
      if (busy.current || submitted) return;
      setError("");
      if (attachment && !photoReady) {
        setError("Wait for the photo preview, or remove the attachment.");
        return;
      }
      busy.current = true;
      setSaving(true);
      try {
        await saveReport({
          title,
          location,
          description,
          ...(attachment ? { photoUri: attachment } : {}),
        });
        setSubmitted(true);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not save the report. Please try again.",
        );
      } finally {
        busy.current = false;
        setSaving(false);
      }
    }

    return (
      <Page title={submitted ? "Report saved" : "Report a waste concern"} back>
        {submitted ? (
          <>
            <Card>
              <Heading>Saved on this device</Heading>

              <Copy>
                No report was sent to barangay staff. It will remain available
                after restarting and signing in with the same demo email.
              </Copy>
            </Card>

            <Button
              label="View my reports"
              onPress={() => openDetail("reports")}
            />
          </>
        ) : (
          <>
            <Field
              label="Report title"
              value={title}
              onChangeText={setTitle}
              editable={!saving}
              maxLength={100}
              placeholder="For example: overflowing bin"
            />

            <Field
              label="Location or landmark"
              value={location}
              onChangeText={setLocation}
              editable={!saving}
              maxLength={200}
            />

            <Field
              label="What happened?"
              value={description}
              onChangeText={setDescription}
              editable={!saving}
              multiline
              maxLength={1000}
            />

            <Card>
              <Heading>Photo evidence · Optional</Heading>
              <Copy>
                Attach one photo. A resized copy stays on this device; nothing
                is uploaded.
              </Copy>
              {attachment && (
                <Image
                  key={attachment}
                  source={{ uri: attachment }}
                  contentFit="contain"
                  accessibilityLabel="Selected report attachment"
                  style={{
                    width: "100%",
                    aspectRatio: 1.2,
                    borderRadius: 14,
                    backgroundColor: "#EAF2EC",
                  }}
                  onLoad={() => setPhotoReady(true)}
                  onError={() => {
                    setPhotoReady(false);
                    setError(
                      "This photo cannot be displayed. Choose another image or remove it.",
                    );
                  }}
                />
              )}
              <Button
                secondary
                label={
                  picking
                    ? "Opening gallery…"
                    : attachment
                      ? "Change photo"
                      : "Choose a photo"
                }
                disabled={picking || saving}
                onPress={chooseAttachment}
              />
              {attachment && (
                <Button
                  secondary
                  label="Remove attachment"
                  disabled={picking || saving}
                  onPress={() => {
                    setAttachment(null);
                    setPhotoReady(false);
                    setError("");
                  }}
                />
              )}
            </Card>
            <Message error text={state.storageError} />

            <Message error text={error} />

            <Button
              label={saving ? "Saving report…" : "Save report on device"}
              onPress={submitReport}
              disabled={saving || picking || (!!attachment && !photoReady)}
            />
          </>
        )}
      </Page>
    );
  }

  if (view === "reports") {
    return (
      <Page title="My reports" back>
        <Copy>
          Local records for {profile.email}. No reports have been sent to
          barangay staff.
        </Copy>
        <Message error text={state.storageError} />
        <Button label="New report" onPress={() => openDetail("new-report")} />

        {!state.reports.length && (
          <Card>
            <Heading>No reports yet</Heading>
            <Copy>Your demo reports will appear here.</Copy>
          </Card>
        )}

        {state.reports.map((report) => (
          <Card key={report.id} onPress={() => openDetail("report", report.id)}>
            <Heading>{report.title}</Heading>
            <Copy>{report.location}</Copy>
            <Copy>{report.status} · Local only</Copy>
            <Copy>{new Date(report.createdAt).toLocaleString()}</Copy>
            {report.photoFile && (
              <SavedPhoto fileName={report.photoFile} label="Report photo" />
            )}
          </Card>
        ))}
      </Page>
    );
  }

  if (view === "report") {
    const report = state.reports.find((item) => item.id === id);

    return (
      <Page
        title={
          deleted ? "Report removed" : report?.title || "Report unavailable"
        }
        back
      >
        <Card>
          {report ? (
            <>
              <Heading>{report.status}</Heading>
              <Copy>{report.location}</Copy>
              <Copy>{report.description}</Copy>
              <Copy>{new Date(report.createdAt).toLocaleString()}</Copy>
              {report.photoFile && (
                <SavedPhoto
                  fileName={report.photoFile}
                  label="Attached report photo"
                />
              )}

              <Copy>
                Demo record only. No officer has received or reviewed this
                report.
              </Copy>
            </>
          ) : (
            <Copy>
              This report was removed or is not available for this demo email.
            </Copy>
          )}
        </Card>
        <Message error text={error} />
        {report && !deleting && (
          <Button
            secondary
            label="Delete local report"
            onPress={() => setDeleting(true)}
          />
        )}
        {report && deleting && (
          <Card>
            <Heading>Delete this local report?</Heading>
            <Copy>
              The record and its saved photo will be removed from this device.
            </Copy>
            <Button
              label="Confirm delete"
              onPress={() => {
                try {
                  removeReport(report.id);
                  setDeleted(true);
                  setDeleting(false);
                } catch {
                  setError("Could not delete this report. Try again.");
                }
              }}
            />
            <Button
              secondary
              label="Keep report"
              onPress={() => setDeleting(false)}
            />
          </Card>
        )}
      </Page>
    );
  }

  if (view === "reward") {
    const reward = REWARDS.find((item) => item.id === id);

    const affordable = !!reward && state.points >= reward.cost;

    function redeem() {
      if (!reward || confirmed || state.points < reward.cost) {
        return;
      }

      dispatch({
        type: "redeem",
        rewardId: reward.id,
      });

      setConfirmed(true);
    }

    return (
      <Page
        title={confirmed ? "Demo redemption complete" : "Reward details"}
        back
      >
        {reward ? (
          <>
            <Card>
              <Heading>{reward.name}</Heading>
              <Copy>{reward.description}</Copy>
              <Copy>{reward.cost} demo points</Copy>

              <Copy>No physical item, voucher, or pickup is issued.</Copy>
            </Card>

            {confirmed ? (
              <>
                <Message text="Your demo balance and redemption history were updated." />

                <Button
                  label="View redemption history"
                  onPress={() => openDetail("redemptions")}
                />
              </>
            ) : (
              <>
                <Copy>Your demo balance: {state.points} points.</Copy>

                <Button
                  label={
                    affordable
                      ? "Confirm demo redemption"
                      : "Not enough demo points"
                  }
                  onPress={redeem}
                  disabled={!affordable}
                />
              </>
            )}
          </>
        ) : (
          <Copy>This reward could not be found.</Copy>
        )}
      </Page>
    );
  }

  if (view === "redemptions") {
    return (
      <Page title="Redemption history" back>
        {!state.redemptions.length && (
          <Card>
            <Heading>No redemptions yet</Heading>

            <Copy>Try redeeming an item from the demo catalog.</Copy>
          </Card>
        )}

        {state.redemptions.map((item) => (
          <Card key={item.id}>
            <Heading>{item.reward}</Heading>

            <Copy>
              {item.cost} points · Demo redemption #{item.id}
            </Copy>

            <Copy>No real reward was issued.</Copy>
          </Card>
        ))}
      </Page>
    );
  }

  if (view === "notifications") {
    return (
      <Page title="Notifications" back>
        <Card>
          <Heading>You&apos;re all caught up</Heading>

          <Copy>
            Real collection updates and report notifications will appear here
            after the backend is connected.
          </Copy>
        </Card>
      </Page>
    );
  }

  if (view === "history") {
    return (
      <Page title="Scan history" back>
        <Copy>
          {state.scans.length} saved scans · {profile.email}
        </Copy>
        <Copy>
          Saved on this device. Sign in with this same demo email after
          restarting to restore them.
        </Copy>
        <Message error text={state.storageError} />
        {!state.scans.length && (
          <Card>
            <Heading>No saved scans yet</Heading>
            <Copy>
              Analyze a photo in the Scan tab. A completed result will be saved
              here automatically.
            </Copy>
          </Card>
        )}
        {state.scans.map((scan) => (
          <Card
            key={scan.id}
            onPress={() => openDetail("scan-record", scan.id)}
          >
            <SavedPhoto
              fileName={scan.photoFile}
              label={`Saved ${MATERIAL_NAMES[scan.label] ?? scan.label} photo`}
            />
            <Heading>{MATERIAL_NAMES[scan.label] ?? scan.label}</Heading>
            <Copy>{new Date(scan.createdAt).toLocaleString()}</Copy>
            <Copy>Model suggestion · View details</Copy>
          </Card>
        ))}
      </Page>
    );
  }

  if (view === "scan-record") {
    const scan = state.scans.find((item) => item.id === id);
    const material = scan
      ? (MATERIAL_NAMES[scan.label] ?? scan.label)
      : "Scan unavailable";
    return (
      <Page title={deleted ? "Scan removed" : material} back>
        {scan ? (
          <>
            <SavedPhoto fileName={scan.photoFile} label="Saved waste scan" />
            <Card>
              <Heading>Model suggestion: {material}</Heading>
              <Copy>{new Date(scan.createdAt).toLocaleString()}</Copy>
              <Copy>
                {CATEGORY_GUIDANCE[material] ??
                  "Check your barangay’s accepted materials before disposal."}
              </Copy>
              <Copy>
                AI can misidentify materials. A scan does not verify disposal or
                earn points.
              </Copy>
            </Card>
            <Message error text={error} />
            {!deleting ? (
              <Button
                secondary
                label="Delete saved scan"
                onPress={() => setDeleting(true)}
              />
            ) : (
              <Card>
                <Heading>Delete this saved scan?</Heading>
                <Copy>
                  The record and saved photo will be removed from this device.
                </Copy>
                <Button
                  label="Confirm delete"
                  onPress={() => {
                    try {
                      removeScan(scan.id);
                      setDeleted(true);
                      setDeleting(false);
                    } catch {
                      setError("Could not delete this scan. Try again.");
                    }
                  }}
                />
                <Button
                  secondary
                  label="Keep scan"
                  onPress={() => setDeleting(false)}
                />
              </Card>
            )}
          </>
        ) : (
          <Card>
            <Heading>
              {deleted ? "Removed from this device" : "Scan unavailable"}
            </Heading>
            <Copy>
              The scan may have been deleted or belongs to another demo email.
            </Copy>
          </Card>
        )}
        <Button
          secondary
          label="View scan history"
          onPress={() => openDetail("history")}
        />
      </Page>
    );
  }

  if (view === "settings") {
    return (
      <Page title="Settings" back>
        <Card>
          <Heading>Collection reminders</Heading>

          <View style={ui.row}>
            <Copy>Preview preference</Copy>

            <Switch
              accessibilityLabel="Demo collection reminder preference"
              value={state.reminders}
              onValueChange={(enabled) =>
                dispatch({
                  type: "reminders",
                  enabled,
                })
              }
            />
          </View>

          <Copy>
            This changes a session preference only. No notification permission
            is requested and no reminders are scheduled.
          </Copy>
        </Card>
      </Page>
    );
  }

  if (view === "help") {
    return (
      <Page title="Help and privacy" back>
        <Card>
          <Heading>About this preview</Heading>

          <Copy>
            CebuCleanAI helps residents explore waste classification, collection
            information, reporting, and rewards.
          </Copy>
        </Card>

        <Card>
          <Heading>AI suggestions</Heading>

          <Copy>
            Classification can be wrong. Check the item and local collection
            rules. Do not use this model to identify hazardous waste.
          </Copy>
        </Card>

        <Card>
          <Heading>Demo data</Heading>

          <Copy>
            Reports and scan photos are saved on this device under your demo
            email. Other demo preferences and rewards may reset. Authentication
            is simulated; matching an email is not secure account access.
          </Copy>
        </Card>

        <Card>
          <Heading>Before public release</Heading>

          <Copy>
            Official support contacts, privacy terms, data retention, account
            deletion, and barangay service coverage must be configured.
          </Copy>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Page unavailable" back>
      <Copy>This screen could not be found.</Copy>
    </Page>
  );
}
