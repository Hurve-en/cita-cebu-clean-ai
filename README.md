<p align="center">
  <img src="./docs_photos/CITA_logo.png" alt="CebuCleanAI logo" width="180" />
</p>

<h1 align="center">CebuCleanAI</h1>

<p align="center">
  Small actions. Cleaner Cebu.
</p>

<p align="center">
  Waste sorting guidance, local collection schedules, and community reporting.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-58-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 58" />
  <img src="https://img.shields.io/badge/React_Native-0.88-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native 0.88" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Supabase-Client_Installed-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase client installed; backend integration pending" />
</p>

<p align="center">
  <a href="#about">About</a> ·
  <a href="#project-status">Status</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#design">Design</a> ·
  <a href="#contributing">Contributing</a>
</p>

> **Early development:** CebuCleanAI is being rebuilt from Flutter using Expo and React Native. The current branch contains the application starter. Product features and Supabase integration are not implemented yet.

## About

CebuCleanAI aims to help Cebu residents make everyday waste disposal decisions: identify an unfamiliar item, check collection information, and report a waste issue.

The project focuses on three questions:

- **Where does this go?** Provide material identification and sorting guidance.
- **When is collection?** Show schedules relevant to a selected barangay.
- **How can I report this?** Let residents describe waste issues and follow their reports.

Collection information will require verified local sources. Classification results will provide guidance, not proof of correct disposal.

## Planned Experience

| Area                 | Intended functionality                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| Waste scanning       | Photograph an item and receive sorting guidance, including uncertain-result handling. |
| Material lookup      | Search materials and read preparation and disposal guidance.                          |
| Collection schedules | Choose a barangay and view published collection information.                          |
| Community reports    | Submit a waste issue with a description, photo, and optional location.                |
| Personal history     | Review saved scans and submitted reports.                                             |
| Account settings     | Manage profile details, security, and notification preferences.                       |

These describe the intended product, not functionality currently available in the app.

## Project Status

### Implemented foundation

- Expo SDK 58 application with React Native and TypeScript.
- Expo Router with starter Home and Explore tabs.
- Native and web navigation components.
- Theme utilities and starter assets.
- Supabase JavaScript client and supporting dependencies installed.

### Design and demonstration

- Figma designs cover the resident lifecycle and recovery states.
- Design examples use illustrative content.
- The running application currently displays the Expo starter.

### Known limitations

- No connected Supabase project.
- No implemented resident authentication or database access policies.
- No integrated waste-classification model.
- No live collection schedules or report submission.
- No automated test suite or CI workflow found in the inspected branch.
- Figma navigation refinement, complete visual QA, and prototype wiring remain unfinished.

### Planned work

- [ ] Review and refine the Figma designs.
- [ ] Build reusable application components.
- [ ] Implement navigation and resident screens.
- [ ] Connect Supabase Auth, database, and storage.
- [ ] Define and test Row Level Security policies.
- [ ] Evaluate a classification model before integration.
- [ ] Implement schedules and waste-report workflows.
- [ ] Add meaningful tests and continuous integration.

## Technology

| Technology   | Role                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| Expo         | Application tooling and access to device capabilities.                          |
| React Native | Mobile interface development.                                                   |
| Expo Router  | File-based navigation.                                                          |
| TypeScript   | Static typing; strict mode is enabled.                                          |
| Supabase     | Intended authentication, database, and storage backend; client installed.       |
| Expo SQLite  | Installed local-storage capability; product persistence is not implemented yet. |

## Getting Started

### Prerequisites

- Node.js compatible with Expo SDK 58 and npm.
- Git.
- A compatible Expo Go installation, simulator, emulator, or browser for previewing the starter.

### Installation

Clone the rebuild branch:

```bash
git clone --branch feat/expo-rebuild https://github.com/Hurve-en/cita-cebu-clean-ai.git
cd cita-cebu-clean-ai
npm ci
```

Start the development server:

```bash
npm run start
```

Follow the terminal instructions to open a supported preview.

### Available commands

| Command            | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `npm run start`    | Start the Expo development server.                             |
| `npm run android`  | Start Expo and open an Android preview.                        |
| `npm run ios`      | Start Expo and open an iOS preview.                            |
| `npm run web`      | Start the web preview.                                         |
| `npm run lint`     | Run Expo’s lint command; initial ESLint setup may be required. |
| `npx tsc --noEmit` | Check TypeScript without generating output.                    |

The commands above are documented for local validation. Passing lint, typecheck, or build results are not claimed here.

### Backend configuration

The current starter does not require Supabase credentials.

Backend setup instructions and environment-variable names will be added when the integration exists. Never put database passwords or Supabase secret/service-role keys in mobile application code.

## Repository Structure

```text
CebuCleanAI/
├── assets/              # Images, icons, and starter assets
├── scripts/             # Development utilities
├── src/
│   ├── app/             # Expo Router screens and root layout
│   ├── components/      # Shared interface components
│   ├── constants/       # Theme constants
│   ├── hooks/           # Shared React hooks
│   └── global.css       # Global web styles
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Design

[Open the CebuCleanAI Figma file](https://www.figma.com/design/HNYwTQLMlBgTWXvxkIXs4w)

The design direction uses forest green, warm neutral surfaces, lime accents, and Manrope typography.

The file includes branding, reusable component states, and resident journeys for onboarding, authentication, scanning, schedules, reports, and settings.

Figma screens are design references. They do not establish that the corresponding app features are implemented.

## Preview the Current Build

1. Start the application.
2. Open the starter Home screen.
3. Switch to Explore to check navigation.
4. Compare the starter with the intended experience in Figma.

Waste scanning, report submission, and authentication are not available in this preview.

## Troubleshooting

**The app still says “Welcome to Expo.”**  
That is expected. The rebuild currently contains the starter screens.

**The development preview is using stale content.**  
Restart Metro with its cache cleared:

```bash
npm run start -- --clear
```

**Supabase features are unavailable.**  
The client dependency is installed, but a backend project has not been connected.

## Contributing

The project is in active rebuild. Before starting substantial work:

1. Open an issue describing the problem or proposed change.
2. Keep the change focused and explain its intended behavior.
3. Follow the repository’s `AGENTS.md` instructions.
4. Run applicable lint and TypeScript checks.
5. Include screenshots for interface changes and report actual validation results.

Do not commit credentials, private user data, or personal report photos. Never treat mock authentication as an access-control mechanism.

## License

See [LICENSE](./LICENSE).

The current license file contains the Expo starter’s MIT notice. Preserve applicable third-party attribution when adding project-specific licensing information.
