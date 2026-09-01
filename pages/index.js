import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";

function ServiceCard({ service, busy, onAction }) {
  return (
    <article className={`service-card ${service.online ? "is-online" : "is-offline"}`}>
      <div className="card-topline">
        <div className="service-mark" aria-hidden="true">{service.name.trim().charAt(0).toUpperCase() || "S"}</div>
        <div className="service-heading">
          <h2>{service.name}</h2>
          <p>{service.description}</p>
        </div>
        <span className="status-pill"><i />{service.online ? "Online" : "Offline"}</span>
      </div>

      <div className="metrics">
        <div><span>Automation</span><strong>{service.automation}</strong></div>
        <div><span>Connection</span><strong>{service.helper}</strong></div>
        <div><span>Endpoint</span><strong>Port {service.port}{service.responseMs !== null ? ` · ${service.responseMs} ms` : ""}</strong></div>
      </div>

      <div className="card-actions">
        {service.online && <a className="open-button" href={`http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:${service.port}${service.openPath || "/"}`} target="_blank" rel="noreferrer">Open service</a>}
        <button
          className={service.online ? "stop-button" : "start-button"}
          disabled={busy}
          onClick={() => onAction(service.id, service.online ? "stop" : "start")}
        >
          {busy ? <span className="spinner" /> : service.online ? "Stop service" : "Launch service"}
        </button>
      </div>
    </article>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "is-checked" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function NotificationSettings({ settings, saving, onChange }) {
  if (!settings) return <section className="notification-panel notification-skeleton" aria-label="Loading notification settings" />;
  return (
    <section className="notification-panel" aria-labelledby="notification-title">
      <div className="notification-main-row">
        <div className="notification-icon" aria-hidden="true">N</div>
        <div className="notification-copy">
          <div className="notification-title-line">
            <h2 id="notification-title">Notifications</h2>
            <span className={settings.notificationsEnabled ? "enabled-label" : "paused-label"}>
              {saving ? "Saving" : settings.notificationsEnabled ? "Enabled" : "Paused"}
            </span>
          </div>
          <p>Send service alerts through your configured ntfy topics.</p>
        </div>
        <Toggle
          checked={settings.notificationsEnabled}
          onChange={(value) => onChange("notificationsEnabled", value)}
          label="Notifications"
        />
      </div>

      {settings.notificationsEnabled && (
        <div className="notification-options">
          <div className="notification-option">
            <div><strong>Servers offline</strong><span>Alert when a service stops responding</span></div>
            <Toggle checked={settings.notifyOffline} onChange={(value) => onChange("notifyOffline", value)} label="Servers offline alerts" />
          </div>
          <div className="notification-option">
            <div><strong>Servers online</strong><span>Alert when a service comes back online</span></div>
            <Toggle checked={settings.notifyOnline} onChange={(value) => onChange("notifyOnline", value)} label="Servers online alerts" />
          </div>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [services, setServices] = useState([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [shutdownArmed, setShutdownArmed] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [dashboardStopped, setDashboardStopped] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Status check failed");
      const data = await response.json();
      setServices(data.services);
      setLastUpdated(new Date());
    } catch {
      setNotice("Local Control could not refresh service status.");
    } finally {
      setStatusLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setSettings)
      .catch(() => setNotice("Notification settings could not be loaded."));
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const summary = useMemo(() => services.filter((service) => service.online).length, [services]);

  async function takeAction(id, action) {
    setBusy(id);
    setNotice("");
    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The action failed.");
      setNotice(data.message);
      setTimeout(refresh, action === "start" ? 5_000 : 1_000);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  async function updateSetting(key, value) {
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSavingSettings(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Settings could not be saved.");
      setSettings(saved);
    } catch (error) {
      setSettings(previous);
      setNotice(error.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function requestShutdown() {
    if (!shutdownArmed) {
      setShutdownArmed(true);
      setTimeout(() => setShutdownArmed(false), 4_000);
      return;
    }

    setShuttingDown(true);
    try {
      const response = await fetch("/api/shutdown", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Local Control could not stop.");
      setDashboardStopped(true);
    } catch (error) {
      setNotice(error.message);
      setShutdownArmed(false);
      setShuttingDown(false);
    }
  }

  return (
    <>
      <Head>
        <title>Local Control</title>
        <meta name="description" content="Monitor and control local automation services over Tailscale." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b1020" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <main>
        <header>
          <div className="brand"><span>LC</span><div><strong>Local Control</strong><small>Private service dashboard</small></div></div>
          <div className="header-actions">
            <button className="refresh-button" onClick={refresh} aria-label="Refresh status">↻</button>
            <button
              className={`shutdown-button ${shutdownArmed ? "is-armed" : ""}`}
              onClick={requestShutdown}
              disabled={shuttingDown}
              aria-label={shutdownArmed ? "Confirm stopping Local Control" : "Stop Local Control"}
            >
              <span aria-hidden="true">⏻</span>{shutdownArmed && <strong>{shuttingDown ? "Stopping…" : "Stop?"}</strong>}
            </button>
          </div>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow"><span /> Tailscale connection</p>
            <h1>Your automations,<br /><em>one quiet command center.</em></h1>
          </div>
          <div className="summary-card">
            <span>System status</span>
            <strong>{statusLoaded ? `${summary} of ${services.length}` : "Checking"}</strong>
            <small>{!statusLoaded ? "Reading service configuration" : services.length === 0 ? "No services configured" : summary === services.length ? "All services operational" : `${services.length - summary} service${services.length - summary === 1 ? "" : "s"} offline`}</small>
          </div>
        </section>

        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

        <section className="services-grid" aria-label="Services">
          {!statusLoaded
            ? [0, 1].map((item) => <div className="service-card skeleton" key={item} />)
            : services.length
            ? services.map((service) => <ServiceCard key={service.id} service={service} busy={busy === service.id} onAction={takeAction} />)
            : <div className="empty-state"><span>+</span><div><h2>No services configured</h2><p>Copy <code>.env.example</code> to <code>.env.local</code>, add service IDs, and restart Local Control.</p></div></div>}
        </section>

        <NotificationSettings settings={settings} saving={savingSettings} onChange={updateSetting} />

        <footer>
          <span><i /> Monitoring every 10 seconds</span>
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Connecting…"}</span>
        </footer>
      </main>
      {dashboardStopped && (
        <div className="stopped-screen" role="status">
          <div><span>LC</span><h2>Local Control stopped</h2><p>Your configured services were not affected. You can close this page.</p></div>
        </div>
      )}
    </>
  );
}
