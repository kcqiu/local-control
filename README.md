# Local Control

Local Control is a private, mobile-first dashboard for monitoring and controlling any number of local Next.js services from an iPhone over Tailscale. Services are defined entirely through environment variables—none are built into the application.

## Features

- Dynamic service cards generated from `.env.local`
- Live health, endpoint port, response time, and common automation states
- Launch, stop, and open controls for every configured service
- Explicit ports or ports read from each project's own `.env`
- Background health checks and optional ntfy online/offline alerts
- Persistent master, offline, and online notification switches
- Two-tap shutdown control for Local Control itself
- Responsive Safari layout with iPhone safe-area support
- Same-origin protection for all state-changing controls

## Requirements

- Windows 10 or 11
- Node.js and npm
- Tailscale connected on the Windows computer and viewing device
- Each managed project must have a launcher (`.cmd`, `.lnk`, or other Windows-launchable file)
- Each project must expose an HTTP route that returns a successful response while the service is healthy

## Setup

1. Clone this repository on the Windows computer.
2. Copy `.env.example` to `.env.local`.
3. Replace the example services with your projects.
4. Double-click `Start Local Control.cmd`.

The launcher installs missing dependencies, creates a fresh production build, detects the computer's Tailscale IPv4 address, and listens on port `3333`. Open the printed address in iPhone Safari and choose **Share → Add to Home Screen** for an app-like shortcut.

## Configuring services

List every service using a unique, comma-separated ID:

```dotenv
LOCAL_CONTROL_SERVICE_IDS=website,worker,booker
```

Each ID gets its own block. The ID is uppercased in variable names; dashes become underscores. For example, `my-app` uses `LOCAL_CONTROL_SERVICE_MY_APP_*`.

```dotenv
LOCAL_CONTROL_SERVICE_WEBSITE_NAME=Customer Website
LOCAL_CONTROL_SERVICE_WEBSITE_DESCRIPTION=Local website development server
LOCAL_CONTROL_SERVICE_WEBSITE_PROJECT_PATH=C:\projects\customer-website
LOCAL_CONTROL_SERVICE_WEBSITE_LAUNCHER=C:\projects\customer-website\start.cmd
LOCAL_CONTROL_SERVICE_WEBSITE_PORT=3000
LOCAL_CONTROL_SERVICE_WEBSITE_STATUS_PATH=/api/status
LOCAL_CONTROL_SERVICE_WEBSITE_OPEN_PATH=/
LOCAL_CONTROL_SERVICE_WEBSITE_ENV_FILE=.env
LOCAL_CONTROL_SERVICE_WEBSITE_NTFY_ENV_KEY=NTFY_TOPIC
```

Restart Local Control after changing `.env.local`.

### Per-service settings

Replace `<ID>` with the normalized uppercase service ID.

| Setting | Required | Purpose | Default |
| --- | --- | --- | --- |
| `LOCAL_CONTROL_SERVICE_<ID>_NAME` | No | Display name | Service ID |
| `LOCAL_CONTROL_SERVICE_<ID>_DESCRIPTION` | No | Card subtitle | `Local Next.js service` |
| `LOCAL_CONTROL_SERVICE_<ID>_PROJECT_PATH` | Yes for launch | Project working directory | None |
| `LOCAL_CONTROL_SERVICE_<ID>_LAUNCHER` | Yes for launch | Windows-launchable file | None |
| `LOCAL_CONTROL_SERVICE_<ID>_PORT` | Yes unless derived | Explicit fallback port | None |
| `LOCAL_CONTROL_SERVICE_<ID>_PORT_ENV_KEY` | No | Comma-separated port keys read from the project's environment file | None |
| `LOCAL_CONTROL_SERVICE_<ID>_ENV_FILE` | No | Absolute path or path relative to the project | `.env` |
| `LOCAL_CONTROL_SERVICE_<ID>_STATUS_PATH` | No | Health route used for monitoring | `/` |
| `LOCAL_CONTROL_SERVICE_<ID>_OPEN_PATH` | No | Route opened by **Open service** | `/` |
| `LOCAL_CONTROL_SERVICE_<ID>_NTFY_ENV_KEY` | No | Topic variable read from the project's environment file | None |
| `LOCAL_CONTROL_SERVICE_<ID>_NTFY_TOPIC` | No | Topic stored directly in `.env.local` | None |

When both `PORT` and `PORT_ENV_KEY` are present, a valid value from the project's environment file wins and `PORT` acts as the fallback. Local Control does not scan ports.

The status route can return HTML, text, or JSON; any successful HTTP response marks the service online. JSON responses with common `monitor`, `scheduler`, or `status` fields receive richer card details automatically.

## Dashboard settings

| Setting | Purpose | Default |
| --- | --- | --- |
| `DASHBOARD_PORT` | Local Control port | `3333` |
| `DASHBOARD_HOST` | Bind address override | Detected Tailscale IPv4 |

Notification topics are read from each project's environment file or from the ignored `.env.local`; they are never committed. Notification choices are saved locally under the ignored `data/` directory.

## Safety notes

- Local Control verifies the configured health route before stopping the process listening on that service's configured port.
- A service cannot target Local Control's own process; the separate two-tap power button handles dashboard shutdown.
- Local Control binds to the Tailscale address when available. If detection fails, it falls back to all local interfaces; set `DASHBOARD_HOST` explicitly if stricter binding is required.
- A project launcher may still trigger its own Windows approval prompts.

## Scripts

- `npm run dev` — run the custom Next.js server in development mode
- `npm run build` — create a production build
- `npm run start` — run the production server

## License

No license has been granted. All rights reserved.
