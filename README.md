# Local Control

A private, mobile-first dashboard for monitoring and controlling the RecGov Booker and Register2Park services from an iPhone over Tailscale.

## Start it

Double-click `Start Local Control.cmd`. On the first run it installs and prepares the dashboard, then starts in stable production mode. The dashboard listens on port `3333` and automatically chooses the computer's Tailscale IPv4 address. The console prints the exact address to open on the iPhone.

Both devices must be connected to Tailscale. Open the printed URL in Safari, then use **Share → Add to Home Screen** for an app-like shortcut.

## Behavior

- Checks both service APIs every 10 seconds while the page is open.
- Runs a background health check every 30 seconds while Local Control is running.
- Sends online/offline and manual start/stop notices to each service's own ntfy topic.
- Includes persistent notification controls: a master switch plus separate offline and online status alerts.
- Includes a guarded top-right power button that stops Local Control itself without affecting either monitored service.
- Uses the existing desktop shortcuts to start services.
- Uses the existing RecGov stop helper and safely verifies Register2Park's process before stopping it.
- Reads Register2Park's `R2P_APP_PORT` from its `.env` on every check. For RecGov it supports `RECGOV_APP_PORT`, `APP_PORT`, or `PORT` in `.env`, and otherwise reads `$appPort` from its existing Windows launcher script.

RecGov's existing launcher requires a Windows administrator approval for clock synchronization. If launched remotely, that prompt still appears on the computer.

## Optional settings

- `DASHBOARD_PORT` changes port 3333.
- `DASHBOARD_HOST` overrides automatic Tailscale address detection.
