<p align="center">
  <img src="./docs_photos/CITA_logo.png" alt="CebuCleanAI logo" width="180" />
</p>

<h1 align="center">CebuCleanAI</h1>

<p align="center">
  <strong>Scan. Segregate. Earn rewards. Support a cleaner Cebu.</strong>
</p>

<p align="center">
  A waste management and urban resilience platform for Cebu communities.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-58-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 58" />
  <img src="https://img.shields.io/badge/React_Native-0.88-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native 0.88" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Supabase-Client_Installed-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase client installed; backend connection pending" />
</p>

<p align="center">
  <a href="#about">About</a> ·
  <a href="#planned-experience">Features</a> ·
  <a href="#rewards-and-grocery-discounts">Rewards</a> ·
  <a href="#project-status">Status</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#design">Design</a>
</p>

> **Under development:** CebuCleanAI is being rebuilt with Expo, React Native, and Supabase. The current app contains shared UI components and a Home preview. AI scanning, disposal verification, rewards, reporting, and the officials’ dashboard are planned features.

## About

CebuCleanAI aims to help residents sort waste, participate in responsible disposal, and report waste issues while giving authorized barangay and city personnel useful community information.

The platform is designed around three connected experiences:

- **For residents:** identify waste, understand disposal guidance, check collection information, and report problems.
- **For participating businesses:** offer grocery or other store discounts through a verified rewards program.
- **For officials:** review community reports and aggregated activity through a future web dashboard.

The project focuses on Cebu City, with Metro Cebu as a potential expansion area. Its intended contribution aligns with **SDG 11 — Sustainable Cities and Communities**.

## Why CebuCleanAI?

Knowing how to sort waste is only part of the problem. Residents also need accessible local information, a reason to maintain good habits, and a practical way to report issues.

CebuCleanAI’s proposed approach combines:

1. Sorting guidance at the point of disposal.
2. Incentives tied to verified actions.
3. Community reporting and local collection information.
4. Aggregated information that can support waste-management decisions.

The goal is to encourage segregation at source, support material recovery, and help communities identify waste problems earlier.

These are intended outcomes. Reductions in hauling costs, waste volume, or flooding have not been measured or demonstrated by this project.

## Who It Is For

| Audience                                     | Intended use                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Residents and households                     | Waste guidance, collection information, disposal participation, and reporting. |
| Barangay officials and authorized reviewers  | Review local reports and manage relevant information.                          |
| City waste-management personnel              | Review aggregated activity and collection insights.                            |
| Grocery stores and local businesses          | Participate in discount and voucher partnerships.                              |
| Junk shops and materials recovery facilities | Potential collection, recovery, or disposal-verification partners.             |
| Environmental organizations                  | Support education, community pilots, and evaluation.                           |

These describe intended audiences, not confirmed government or business partnerships.

## Planned Experience

### Resident Mobile App

| Feature                    | Intended behavior                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------- |
| AI waste scanner           | Photograph an item and receive a suggested material classification.                |
| Segregation guidance       | Explain preparation and disposal steps, with locally reviewed guidance.            |
| Uncertain-result handling  | Ask for another photo or manual lookup when identification is unreliable.          |
| Disposal logging           | Submit evidence of a disposal activity for verification.                           |
| Points and rewards         | Earn points for eligible, verified disposal activities.                            |
| Grocery discounts          | Redeem points for offers from participating partners.                              |
| Issue reporting            | Report illegal dumping, overflowing waste containers, or waste obstructing drains. |
| Collection schedules       | View published schedules for a selected barangay.                                  |
| Collection-point discovery | Find verified collection points, junk shops, and materials recovery facilities.    |
| Education                  | Access practical guidance in English and Bisaya.                                   |
| Personal history           | Review saved scans, reports, reward activity, and redemptions.                     |
| Community participation    | Explore future barangay challenges and opt-in leaderboards.                        |

Scanning and disposal verification are separate actions. Identifying an item does not establish that it was disposed of correctly.

### Officials’ Web Dashboard

The planned dashboard will support:

- Review and status updates for community reports.
- Barangay-scoped access for authorized personnel.
- Aggregated scanning and verified disposal activity.
- Maps of reported problem areas.
- Collection and material-recovery insights.
- Indicators relevant to the project’s SDG 11 objectives.

Live updates, heatmaps, and impact indicators require implemented data collection and validation. They are not available in the current build.

## Rewards and Grocery Discounts

The proposed rewards program connects verified disposal activities with offers from participating businesses.

### Intended Flow

1. A resident scans or identifies an item and reads the disposal guidance.
2. The resident logs an eligible disposal activity with supporting evidence.
3. A verification process checks eligibility and duplicate submissions.
4. Approved activity earns points recorded by the backend.
5. The resident exchanges points for an available partner offer.
6. The partner validates a unique voucher or QR code at redemption.

### What Residents Could Redeem

Subject to partner agreements, offers could include:

- Grocery discounts.
- Discounts at participating local stores.
- Partner vouchers or promotional offers.
- Benefits from participating recycling or recovery businesses.

No store partnerships, discount amounts, point values, or redemption terms are confirmed.

### Verification and Abuse Prevention

A photograph alone cannot reliably prove correct disposal. Before rewards become redeemable, the program needs:

- A defined verification method, potentially involving authorized reviewers or participating collection partners.
- Duplicate and replay checks for submitted evidence.
- Server-controlled point awards and an auditable points ledger.
- Atomic redemption checks to prevent spending the same points twice.
- Unique vouchers with expiry, redemption status, and partner validation.
- Clear eligibility, rejection, and dispute rules.

Classification results and client-submitted point values must never directly authorize rewards.

### Funding and Partner Model

The initial proposal is a small pilot with one to three local partners.

Participating businesses may fund offers as promotions, or a sponsor may reimburse eligible discounts. Funding, settlement, and redemption responsibilities must be agreed before real offers are published.

Points are intended as program benefits, not a promise of cash value.

## AI Classification Direction

The intended scanner will evaluate waste materials such as paper, plastic, metal, glass, and organic waste, then map them to reviewed disposal guidance.

On-device inference is the preferred direction for reducing uploads and enabling offline scanning. The model and React Native inference library have not been selected or validated for the rebuild.

Before integration, the project must evaluate:

- Accuracy on representative local waste images.
- Model licensing and permitted use.
- Device compatibility, inference speed, and application size.
- Unknown, mixed-material, and low-confidence inputs.
- Safe handling of hazardous or unidentifiable waste.

The app must support an “uncertain” result. It must not present a model prediction as proof of safety or correct disposal.

Offline scanning is a goal. Authentication, report submission, reward verification, and voucher redemption will require server connectivity.

## Technology

### Current Application Foundation

| Technology                    | Current role                                           |
| ----------------------------- | ------------------------------------------------------ |
| Expo SDK 58                   | Application tooling and device-capability framework.   |
| React Native                  | Mobile interface development.                          |
| Expo Router                   | File-based navigation.                                 |
| TypeScript                    | Static typing.                                         |
| Supabase JavaScript client    | Installed; backend connection is pending.              |
| Expo SQLite                   | Installed; product persistence is not implemented yet. |
| ESLint and Expo configuration | Local lint tooling.                                    |

### Planned Services

| Area                  | Direction                                                           |
| --------------------- | ------------------------------------------------------------------- |
| Authentication        | Supabase Auth.                                                      |
| Database              | Supabase PostgreSQL with access policies.                           |
| Report evidence       | Access-controlled Supabase Storage.                                 |
| Privileged operations | Trusted server-side logic for verification, points, and redemption. |
| Officials’ dashboard  | Next.js-based web application; implementation pending.              |
| AI inference          | On-device model and runtime selected after evaluation.              |
| Geographic features   | Mapping provider and spatial requirements to be evaluated.          |

Flutter and the previous custom backend are not part of the active rebuild. Redis, payment processors, advanced routing services, and IoT infrastructure are not current dependencies.

## Project Status

### Implemented

- Expo and React Native project foundation.
- Theme colors and reusable text/view utilities.
- Shared button and card components.
- Resident Home preview.
- Home and Explore starter navigation.
- Supabase client dependency installation.

### Design and Sample Content

- Figma branding, component states, and resident journey screens.
- Illustrative collection information in the Home preview.
- Disabled Scan action while scanner implementation is pending.

The existing Figma draft predates the restored rewards scope. Disposal verification, points, partner offers, and redemption journeys still need design coverage.

### Known Limitations

- No connected Supabase project.
- No implemented resident authentication or tested database access policies.
- No integrated AI classification.
- No live schedules, reporting service, or verified collection-point directory.
- No disposal verification, points ledger, or voucher redemption.
- No confirmed reward partners.
- No implemented officials’ dashboard.
- No demonstrated citywide deployment or measured environmental impact.
- Figma refinement, full visual QA, and prototype wiring remain incomplete.

### Development Roadmap

**Phase 1 — Resident foundation**

- [x] Initialize the Expo application.
- [x] Add shared UI components and a Home preview.
- [ ] Implement resident navigation and screens.
- [ ] Connect authentication and user profiles.
- [ ] Evaluate and integrate waste classification.
- [ ] Implement reporting and collection information.

**Phase 2 — Controlled rewards pilot**

- [ ] Define eligible disposal activities and verification rules.
- [ ] Design disposal evidence and reward journeys.
- [ ] Implement server-controlled points and activity history.
- [ ] Demonstrate rewards with clearly labeled, non-redeemable test offers.
- [ ] Confirm partner funding and redemption responsibilities.
- [ ] Pilot unique, single-use vouchers with participating partners.

**Phase 3 — Community operations**

- [ ] Build the officials’ dashboard.
- [ ] Introduce verified collection-point information.
- [ ] Add English and Bisaya educational content.
- [ ] Evaluate report maps, community challenges, and opt-in leaderboards.
- [ ] Define and measure pilot outcomes.

**Longer-term exploration**

Optional smart bins, advanced collection analytics, route optimization, and wider rollout will depend on pilot results and available resources.

## Getting Started

### Prerequisites

- Node.js compatible with Expo SDK 58 and npm.
- Git.
- A compatible mobile preview environment or browser.

### Install

```bash
git clone https://github.com/Hurve-en/cita-cebu-clean-ai.git
cd cita-cebu-clean-ai
npm ci
```

### Run

```bash
npm run start
```

Follow Expo’s terminal instructions to open a supported preview.

| Command                                    | Purpose                         |
| ------------------------------------------ | ------------------------------- |
| `npm run start`                            | Start the development server.   |
| `npm run android`                          | Open an Android preview.        |
| `npm run ios`                              | Open an iOS preview.            |
| `npm run web`                              | Open the web preview.           |
| `npm run lint`                             | Run lint checks.                |
| `npx tsc --noEmit --project tsconfig.json` | Check project TypeScript types. |

The current Home preview does not require Supabase credentials.

Environment-variable instructions will be added when the backend connection is implemented. Never include database passwords or secret/service-role keys in application bundles.

## Design

[Open the CebuCleanAI Figma file](https://www.figma.com/design/HNYwTQLMlBgTWXvxkIXs4w)

The current direction uses forest green, warm neutral surfaces, lime accents, and Manrope typography.

The app currently uses system fonts while font integration is pending. Designs may change as implementation and usability testing reveal improvements.

## Preview the Current Build

1. Start the application.
2. Open Home.
3. Review the sorting introduction and sample collection card.
4. Confirm the page scrolls and remains readable.
5. Switch between the existing starter tabs.

The Scan button is intentionally disabled. Collection times are illustrative, and the preview does not award points or issue vouchers.

## Privacy and Security Requirements

The planned implementation must:

- Enforce ownership and role permissions on the backend.
- Restrict officials to authorized geographic or organizational scopes.
- Keep private report evidence and precise locations access-controlled.
- Request camera and location permissions when needed.
- Define photo retention, deletion, and account-deletion behavior.
- Protect verification and redemption endpoints from abuse.
- Record points and redemption changes in an auditable ledger.
- Prevent residents from assigning roles, awarding points, or approving their own evidence.

These are implementation requirements, not security guarantees about the current preview.

## Contributing

Before starting substantial work:

1. Open an issue describing the problem or proposed change.
2. Agree on scope, especially for rewards or data-access changes.
3. Follow [AGENTS.md](./AGENTS.md).
4. Make focused changes on a feature branch.
5. Run lint and TypeScript checks.
6. Include screenshots for UI changes and actual validation results.

Do not commit credentials, private report photos, or personal data.

## License

See [LICENSE](./LICENSE).

Preserve applicable Expo and third-party attribution when updating project-specific licensing information.
