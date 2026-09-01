# Local Control

Local Control is a private, mobile-first dashboard for monitoring and controlling local Next.js automation services from an iPhone over Tailscale. It currently supports RecGov Booker and Register2Park.

## Features

- Live service health, automation state, endpoint port, and response time
- Launch, stop, and open controls for each service
- Ports detected from each service's configuration rather than scanned
- Background health checks and optional ntfy online/offline alerts
- Persistent master, offline, and online notification switches
- Two-tap shutdown control for Local Control itself
- Responsive Safari layout with iPhone safe-area support
- Same-origin protection for all state-changing controls

## Requirements

- Windows 10 or 11
- Node.js and npm
- Tailscale connected on the Windows computer and viewing device
- The RecGov Booker and Register2Park projects and their existing launchers

## Setup

1. Clone this repository on the Windows computer.
2. If your service folders or launcher names differ from the defaults, copy `.env.example` to `.env.local` and set the four path overrides.
3. Double-click `Start Local Control.cmd`.

The first run installs dependencies and creates a production build. Local Control then detects the computer's Tailscale IPv4 address and listens on port `3333`. Open the printed address in iPhone Safari and choose **Share → Add to Home Screen** for an app-like shortcut.

Default locations are resolved beneath the current Windows user profile:

- RecGov project: `Documents\ChatGPT\recgov`
- Register2Park project: `Documents\auto register r2park`
- RecGov launcher: `Desktop\RecGov Booker.cmd`
- Register2Park launcher: `Desktop\Register2Park Helper.lnk`

## Configuration

| Setting | Purpose | Default |
| --- | --- | --- |
| `DASHBOARD_PORT` | Local Control port | `3333` |
| `DASHBOARD_HOST` | Bind address override | Detected Tailscale IPv4 |
| `LOCAL_CONTROL_RECGOV_PATH` | RecGov project folder | Current-user default above |
| `LOCAL_CONTROL_REGISTER2PARK_PATH` | Register2Park project folder | Current-user default above |
| `LOCAL_CONTROL_RECGOV_LAUNCHER` | RecGov launcher file | Current-user default above |
| `LOCAL_CONTROL_REGISTER2PARK_LAUNCHER` | Register2Park launcher file | Current-user default above |

Register2Park's port comes from `R2P_APP_PORT` in its `.env`. RecGov checks `RECGOV_APP_PORT`, `APP_PORT`, or `PORT` in its `.env`, then falls back to `$appPort` in `scripts\start-recgov.ps1`.

Notification topics are read directly from each service's own `.env`; they are never stored in this repository. User notification choices are saved locally under `data/`, which is also excluded from Git.

## Notes

- Local Control binds to the Tailscale address when available. If detection fails, it falls back to all local interfaces; set `DASHBOARD_HOST` explicitly if stricter binding is required.
- RecGov's existing launcher may request Windows administrator approval for clock synchronization.
- Stopping a service terminates the process listening on its configured port only after its status API has been verified.

## Scripts

- `npm run dev` — run the custom Next.js server in development mode
- `npm run build` — create a production build
- `npm run start` — run the production server

## License

No license has been granted. All rights reserved.
