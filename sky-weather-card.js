/*
 * Sky Weather Card — a calm, glanceable weather card for Home Assistant.
 * type: custom:sky-weather-card
 * entity: weather.forecast_home      (required)
 * hourly_entity: weather.x_hourly    (optional, if hourly forecasts live on a separate entity, e.g. BoM)
 * name: Home                         (optional)
 * hours: 12                          (optional, hourly items)
 * days: 7                            (optional, daily rows)
 */
const ICONS = {
  sun: `<circle cx="16" cy="16" r="6.5" fill="#FFD43B"/><g stroke="#FFD43B" stroke-width="2.2" stroke-linecap="round">${[0,45,90,135,180,225,270,315].map(a=>`<line x1="16" y1="3.2" x2="16" y2="6" transform="rotate(${a} 16 16)"/>`).join("")}</g>`,
  moon: `<path d="M20.5 5.5a10.5 10.5 0 1 0 6 18.8A9 9 0 0 1 20.5 5.5z" fill="#F4F1DE"/>`,
  cloud: (f="#fff") => `<path d="M9.5 25h14a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 9.8 15.6 4.7 4.7 0 0 0 9.5 25z" fill="${f}"/>`,
  rain: `<g stroke="#5AC8FA" stroke-width="2" stroke-linecap="round"><line x1="12" y1="27" x2="11" y2="30"/><line x1="17" y1="27" x2="16" y2="30"/><line x1="22" y1="27" x2="21" y2="30"/></g>`,
  snow: `<g fill="#fff"><circle cx="11.5" cy="28.5" r="1.3"/><circle cx="16.5" cy="29.5" r="1.3"/><circle cx="21.5" cy="28.5" r="1.3"/></g>`,
  bolt: `<path d="M17 24l-3 5h3l-1.5 3.5L21 27h-3l1.5-3z" fill="#FFD43B"/>`,
  fog: `<g stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"><line x1="7" y1="13" x2="25" y2="13"/><line x1="5" y1="18" x2="27" y2="18"/><line x1="8" y1="23" x2="24" y2="23"/></g>`,
  wind: `<g stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M5 13h15a3.5 3.5 0 1 0-3.5-3.5"/><path d="M5 19h20a3.5 3.5 0 1 1-3.5 3.5"/></g>`,
};

function iconSvg(cond, night) {
  const sm = (svg, s = 0.62, x = 1, y = 0) => `<g transform="translate(${x} ${y}) scale(${s})">${svg}</g>`;
  const orb = night ? ICONS.moon : ICONS.sun;
  let body;
  switch (cond) {
    case "sunny": body = ICONS.sun; break;
    case "clear-night": body = ICONS.moon; break;
    case "partlycloudy": body = sm(orb, 0.7, 6, -1) + ICONS.cloud(); break;
    case "cloudy": body = sm(ICONS.cloud("#C9D2DC"), 0.7, 9, -3) + ICONS.cloud(); break;
    case "rainy": case "pouring": body = `<g transform="translate(0 -3)">${ICONS.cloud()}</g>` + ICONS.rain; break;
    case "lightning": case "lightning-rainy": body = `<g transform="translate(0 -3)">${ICONS.cloud()}</g>` + ICONS.bolt; break;
    case "snowy": case "snowy-rainy": case "hail": body = `<g transform="translate(0 -3)">${ICONS.cloud()}</g>` + ICONS.snow; break;
    case "fog": body = ICONS.fog; break;
    case "windy": case "windy-variant": body = ICONS.wind; break;
    default: body = ICONS.cloud();
  }
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
}

const LABELS = {
  "clear-night": "Clear", cloudy: "Cloudy", exceptional: "Unusual", fog: "Fog", hail: "Hail",
  lightning: "Thunderstorms", "lightning-rainy": "Thunderstorms", partlycloudy: "Partly Cloudy",
  pouring: "Heavy Rain", rainy: "Rain", snowy: "Snow", "snowy-rainy": "Sleet", sunny: "Sunny",
  windy: "Windy", "windy-variant": "Windy",
};

// Sky gradients keyed by mood (top → bottom)
const SKIES = {
  clearDay: ["#2F6FC2", "#5C9CE0"],
  clearNight: ["#0B1430", "#23335E"],
  cloudyDay: ["#56708C", "#8399AE"],
  cloudyNight: ["#1C2533", "#37465A"],
  rain: ["#3B4B5E", "#5F7186"],
  storm: ["#262B3A", "#4A4E63"],
  snow: ["#7D93AB", "#B4C3D3"],
};

function skyFor(cond, night) {
  if (["rainy", "pouring"].includes(cond)) return SKIES.rain;
  if (cond?.startsWith("lightning")) return SKIES.storm;
  if (["snowy", "snowy-rainy", "hail"].includes(cond)) return SKIES.snow;
  if (["cloudy", "fog"].includes(cond)) return night ? SKIES.cloudyNight : SKIES.cloudyDay;
  return night ? SKIES.clearNight : SKIES.clearDay;
}

// temperature → colour along a cool-to-warm scale (°C)
function tempColor(t) {
  const stops = [[0, [94, 160, 255]], [10, [90, 200, 250]], [16, [120, 220, 170]], [21, [255, 214, 10]], [27, [255, 159, 10]], [33, [255, 69, 58]]];
  if (t <= stops[0][0]) return `rgb(${stops[0][1]})`;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k))})`;
    }
  }
  return `rgb(${stops.at(-1)[1]})`;
}

class SkyWeatherCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity || !config.entity.startsWith("weather.")) throw new Error("Set entity: weather.xxx");
    this._config = { hours: 12, days: 7, ...config };
    this._hourly = this._daily = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._resubscribe();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._popupCard) this._popupCard.hass = hass;
    const st = hass.states[this._config.entity];
    const key = st && st.last_updated + (hass.states["sun.sun"]?.state || "");
    if (first) this._resubscribe();
    if (key !== this._lastKey) { this._lastKey = key; this._render(); }
  }

  connectedCallback() { this._resubscribe(); }
  disconnectedCallback() { this._unsub(); }

  _unsub() { (this._subs || []).forEach((p) => p.then((u) => u && u()).catch(() => {})); this._subs = []; }

  _resubscribe() {
    if (!this._hass || !this._config || !this.isConnected) return;
    this._unsub();
    // Some providers (e.g. BoM) split hourly and daily forecasts across two entities
    const sub = (type) => this._hass.connection.subscribeMessage(
      (msg) => { this[type === "hourly" ? "_hourly" : "_daily"] = msg.forecast || []; this._render(); },
      { type: "weather/subscribe_forecast", forecast_type: type,
        entity_id: type === "hourly" && this._config.hourly_entity ? this._config.hourly_entity : this._config.entity }
    ).catch(() => null);
    this._subs = [sub("hourly"), sub("daily")];
  }

  getCardSize() { return this._config?.layout === "widget" ? 3 : 7; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  // Opens the full forecast in a modal sheet. A native <dialog> sits in the browser's
  // top layer, so dashboard transforms/backdrop-filters can't clip or mis-position it.
  _openPopup() {
    if (this._dialog) return;
    if (!document.getElementById("sky-weather-dialog-style")) {
      const s = document.createElement("style");
      s.id = "sky-weather-dialog-style";
      s.textContent = `
        dialog.sky-weather-dialog { padding:0; border:none; background:transparent; color:#fff;
          width:min(420px, calc(100vw - 24px)); max-height:calc(100dvh - 32px); overflow:auto;
          border-radius:22px; scrollbar-width:none; overscroll-behavior:contain; }
        dialog.sky-weather-dialog::-webkit-scrollbar { display:none; }
        dialog.sky-weather-dialog::backdrop { background:rgba(0,0,0,.4); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); }
        dialog.sky-weather-dialog[open] { animation: skyIn .28s cubic-bezier(.2,.8,.2,1); }
        @keyframes skyIn { from { opacity:0; transform:translateY(12px) scale(.97); } to { opacity:1; transform:none; } }
        @media (prefers-reduced-motion: reduce) { dialog.sky-weather-dialog[open] { animation:none; } }
        .sky-weather-dialog .sky-close { position:sticky; top:10px; float:right; margin:10px 10px -46px 0; z-index:5;
          width:32px; height:32px; border-radius:50%; border:none; cursor:pointer; color:#fff; font-size:18px; line-height:32px;
          background:rgba(0,0,0,.28); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); }
        .sky-weather-dialog .sky-close:focus-visible, .sky-weather-dialog .sky-more:focus-visible { outline:2px solid #fff; outline-offset:2px; }
        .sky-weather-dialog .sky-more { display:block; width:100%; margin-top:8px; padding:12px; border:none; border-radius:14px; cursor:pointer;
          font:500 .95rem -apple-system, "SF Pro Text", system-ui, sans-serif; color:#fff;
          background:rgba(255,255,255,.12); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); }`;
      document.head.appendChild(s);
    }
    const dlg = document.createElement("dialog");
    dlg.className = "sky-weather-dialog";
    dlg.setAttribute("aria-label", `${this._config.name || "Weather"} forecast`);
    const close = document.createElement("button");
    close.className = "sky-close"; close.setAttribute("aria-label", "Close"); close.textContent = "✕";
    const card = document.createElement("sky-weather-card");
    card.setConfig({ ...this._config, layout: "full", tap_action: "none" });
    const more = document.createElement("button");
    more.className = "sky-more"; more.textContent = "More details";
    dlg.append(close, card, more);
    document.body.appendChild(dlg);
    card.hass = this._hass;
    this._dialog = dlg; this._popupCard = card;
    const done = () => dlg.close();
    close.addEventListener("click", done);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) done(); }); // backdrop tap
    more.addEventListener("click", () => {
      done();
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
    });
    dlg.addEventListener("close", () => { dlg.remove(); this._dialog = this._popupCard = null; this.shadowRoot.querySelector("ha-card")?.focus(); });
    dlg.showModal();
  }
  static getStubConfig(hass) { return { entity: Object.keys(hass.states).find((e) => e.startsWith("weather.")) }; }

  _fmtHour(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString(this._hass.locale?.language || undefined, { hour: "numeric", timeZone: this._hass.config.time_zone }).replace(/\s?([ap])\.?m\.?/i, (m, p) => p.toLowerCase() + "m");
  }
  _fmtDay(iso, i) {
    if (i === 0) return "Today";
    return new Date(iso).toLocaleDateString(this._hass.locale?.language || undefined, { weekday: "short", timeZone: this._hass.config.time_zone });
  }
  _isNightAt(iso) {
    const sun = this._hass.states["sun.sun"];
    if (!sun) return false;
    const t = new Date(iso).getTime();
    const rise = new Date(sun.attributes.next_rising).getTime();
    const set = new Date(sun.attributes.next_setting).getTime();
    // Compare time-of-day: night is the stretch from sunset to sunrise (wrapping midnight)
    const day = 86400000;
    const tod = (x) => ((x % day) + day) % day;
    const nt = tod(t), nr = tod(rise), ns = tod(set);
    return ns < nr ? nt >= ns && nt < nr : nt >= ns || nt < nr;
  }

  _summary(st, hourly) {
    if (!hourly?.length) return "";
    const now = st.state;
    const change = hourly.slice(1, 13).find((h) => h.condition !== now);
    const rain = hourly.slice(0, 12).find((h) => (h.precipitation || 0) >= 0.3);
    if (rain) return `Rain likely around ${this._fmtHour(rain.datetime)}.`;
    const wind = Math.max(...hourly.slice(0, 12).map((h) => h.wind_speed || 0));
    const windTxt = wind >= 25 ? ` Winds up to ${Math.round(wind)} ${st.attributes.wind_speed_unit || "km/h"}.` : "";
    if (change) return `${LABELS[change.condition] || change.condition} conditions from ${this._fmtHour(change.datetime)}.${windTxt}`;
    return `${LABELS[now] || now} conditions for the rest of the day.${windTxt}`;
  }

  _render() {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    const st = this._hass.states[this._config.entity];
    if (!st) { this.shadowRoot.innerHTML = `<ha-card style="padding:16px">Entity not found: ${this._config.entity}</ha-card>`; return; }
    const a = st.attributes;
    const unit = "°";
    const night = this._hass.states["sun.sun"]?.state === "below_horizon";
    const [top, bottom] = skyFor(st.state, night);
    // HIG: over bright backgrounds, add a 35% dimming layer so white text stays legible
    const bright = ["snowy", "snowy-rainy", "hail"].includes(st.state);
    const widget = this._config.layout === "widget";
    const interactive = this._config.tap_action !== "none";
    const place = this._config.name || a.friendly_name || "Weather";
    const hourly = (this._hourly || []).slice(0, this._config.hours);
    const daily = (this._daily || []).slice(0, this._config.days);
    const today = daily[0];
    const r = (v) => (v == null || isNaN(v) ? "–" : Math.round(v));

    const hoursHtml = hourly.map((h, i) => `
      <div class="hour">
        <div class="h-time">${i === 0 ? "Now" : this._fmtHour(h.datetime)}</div>
        <div class="h-icon">${iconSvg(h.condition, this._isNightAt(h.datetime))}</div>
        ${(h.precipitation_probability ?? 0) >= 20 ? `<div class="h-pop">${Math.round(h.precipitation_probability)}%</div>` : ""}
        <div class="h-temp">${r(i === 0 ? a.temperature : h.temperature)}${unit}</div>
      </div>`).join("");

    let daysHtml = "";
    if (daily.length) {
      const lo = Math.min(...daily.map((d) => d.templow ?? d.temperature));
      const hi = Math.max(...daily.map((d) => d.temperature));
      const span = Math.max(1, hi - lo);
      daysHtml = daily.map((d, i) => {
        const dl = d.templow ?? d.temperature;
        const left = ((dl - lo) / span) * 100, width = Math.max(4, ((d.temperature - dl) / span) * 100);
        const dot = i === 0 && a.temperature != null
          ? `<span class="dot" style="left:${Math.min(100, Math.max(0, ((a.temperature - lo) / span) * 100))}%"></span>` : "";
        return `
        <div class="day">
          <div class="d-name">${this._fmtDay(d.datetime, i)}</div>
          <div class="d-icon">${iconSvg(d.condition, false)}${(d.precipitation_probability ?? 0) >= 20 ? `<span class="d-pop">${Math.round(d.precipitation_probability)}%</span>` : ""}</div>
          <div class="d-lo">${r(dl)}${unit}</div>
          <div class="bar"><span class="fill" style="left:${left}%;width:${width}%;background:linear-gradient(90deg,${tempColor(dl)},${tempColor(d.temperature)})"></span>${dot}</div>
          <div class="d-hi">${r(d.temperature)}${unit}</div>
        </div>`;
      }).join("");
    }

    const details = [
      ["UV", a.uv_index != null ? r(a.uv_index) : null],
      ["Humidity", a.humidity != null ? `${r(a.humidity)}%` : null],
      ["Wind", a.wind_speed != null ? `${r(a.wind_speed)} ${a.wind_speed_unit || ""}` : null],
      ["Feels like", a.apparent_temperature != null ? `${r(a.apparent_temperature)}${unit}` : null],
    ].filter(([, v]) => v != null);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card {
          position:relative; overflow:hidden; color:#fff; border:none;
          border-radius: var(--ha-card-border-radius, 18px);
          background: transparent;
          font-family: -apple-system, "SF Pro Display", "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          padding: 20px 16px 16px;
          cursor: pointer;
        }
        /* sky lives on its own layer so dashboard-wide card themes can't flatten it */
        .sky { position:absolute; inset:0; z-index:0; border-radius:inherit; background: linear-gradient(180deg, ${top} 0%, ${bottom} 100%); transition: background 1s ease; }
        .inner { position:relative; z-index:1; }
        .hero { text-align:center; padding: 4px 0 18px; }
        .place { font-size: 1.05rem; font-weight: 500; letter-spacing: .01em; text-shadow: 0 1px 2px rgba(0,0,0,.15); }
        .temp { font-size: 4.6rem; line-height: 1; font-weight: 200; margin: 2px 0 2px 0.18em; letter-spacing: -0.02em; text-shadow: 0 1px 3px rgba(0,0,0,.12); }
        .cond { font-size: 1.05rem; font-weight: 500; opacity: .92; }
        .hl { font-size: 1.05rem; font-weight: 500; margin-top: 2px; }
        /* Apple HIG: panels sit in the content layer, so use a standard "thin" material
           (blur + slight darkening), not Liquid Glass. Text on it uses vibrant label levels. */
        :host {
          --label: rgba(255,255,255,1);          /* primary */
          --label-2: rgba(255,255,255,.62);      /* secondary */
          --label-3: rgba(255,255,255,.42);      /* tertiary */
          --separator: rgba(255,255,255,.2);
          --material: rgba(0,0,0,.14);
        }
        .sky::after { content:""; position:absolute; inset:0; border-radius:inherit; background: rgba(0,0,0,${bright ? 0.35 : 0}); }
        .panel {
          background: var(--material);
          -webkit-backdrop-filter: blur(20px) saturate(160%); backdrop-filter: blur(20px) saturate(160%);
          border-radius: 14px; padding: 10px 12px 12px; margin-top: 10px;
        }
        .label { font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--label-2); display:flex; align-items:center; gap:6px; }
        .summary { font-size: .92rem; font-weight: 500; padding: 2px 0 10px; border-bottom: .5px solid var(--separator); }
        .hours { display:flex; gap: 4px; overflow-x:auto; padding-top: 10px; scrollbar-width: none; scroll-snap-type: x proximity; }
        .hours::-webkit-scrollbar { display:none; }
        .hour { flex: 0 0 auto; min-width: 46px; display:flex; flex-direction:column; align-items:center; gap: 6px; scroll-snap-align: start; }
        .h-time { font-size: .85rem; font-weight: 600; }
        .h-icon svg, .d-icon svg { width: 28px; height: 28px; display:block; filter: drop-shadow(0 1px 1px rgba(0,0,0,.12)); }
        .h-pop, .d-pop { font-size: .68rem; font-weight: 700; color: #8FD3FF; }
        .h-temp { font-size: 1.05rem; font-weight: 500; }
        .days { padding-top: 4px; }
        .day { display:grid; grid-template-columns: 3.4em 2.4em 2.6em 1fr 2.6em; align-items:center; gap: 10px; padding: 9px 0; border-top: .5px solid var(--separator); }
        .day:first-child { border-top: none; }
        .d-name { font-size: 1.02rem; font-weight: 500; }
        .d-icon { display:flex; flex-direction:column; align-items:center; }
        .d-lo { text-align:right; font-size: 1.02rem; font-weight: 500; color: var(--label-2); }
        .d-hi { font-size: 1.02rem; font-weight: 500; }
        .bar { position:relative; height: 5px; border-radius: 3px; background: rgba(0,0,0,.18); }
        .fill { position:absolute; top:0; bottom:0; border-radius: 3px; }
        .dot { position:absolute; top:50%; width:7px; height:7px; margin:-3.5px 0 0 -3.5px; border-radius:50%; background:#fff; box-shadow: 0 0 0 1.5px rgba(0,0,0,.25); }
        .details { display:grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
        .det { text-align:left; }
        .det b { display:block; font-size: 1.15rem; font-weight: 500; margin-top: 2px; }
        /* Widget layout: medium home-screen-widget proportions */
        ha-card.widget { padding: 14px 16px 14px; }
        ha-card.static { cursor: default; }
        .w-top { display:flex; justify-content:space-between; align-items:flex-start; gap: 12px; }
        .w-place { font-size: .95rem; font-weight: 600; display:flex; align-items:center; gap:4px; }
        .w-place svg { width: 11px; height: 11px; }
        .w-temp { font-size: 2.9rem; line-height: 1.05; font-weight: 300; letter-spacing: -0.02em; margin-left: -2px; }
        .w-right { text-align:right; display:flex; flex-direction:column; align-items:flex-end; }
        .w-right svg { width: 26px; height: 26px; display:block; margin-bottom: 4px; filter: drop-shadow(0 1px 1px rgba(0,0,0,.12)); }
        .w-cond, .w-hl { font-size: .82rem; font-weight: 600; }
        .w-hours { display:grid; grid-template-columns: repeat(6, 1fr); margin-top: 12px; }
        .w-hours .hour { min-width: 0; gap: 4px; }
        .w-hours .h-time { font-size: .75rem; color: var(--label-2); }
        .w-hours .h-icon svg { width: 24px; height: 24px; }
        .w-hours .h-temp { font-size: .9rem; }
        ha-card:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
        /* Accessibility settings: thicker, opaque material and stronger labels */
        @media (prefers-reduced-transparency: reduce) { .panel { background: rgba(0,0,0,.32); backdrop-filter:none; -webkit-backdrop-filter:none; } }
        @media (prefers-contrast: more) {
          :host { --label-2: rgba(255,255,255,.85); --label-3: rgba(255,255,255,.7); --separator: rgba(255,255,255,.4); --material: rgba(0,0,0,.35); }
        }
      </style>
      <ha-card class="${widget ? "widget" : ""} ${interactive ? "" : "static"}" ${interactive ? `role="button" tabindex="0"` : ""} aria-label="${place} weather: ${r(a.temperature)} degrees, ${LABELS[st.state] || st.state}${widget ? ". Opens full forecast" : ""}">
        <div class="sky"></div>
        <div class="inner">
        ${widget ? `
        <div class="w-top">
          <div>
            <div class="w-place">${place}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M11 1L1 5.2l4.4 1.4L6.8 11z" fill="#fff"/></svg></div>
            <div class="w-temp">${r(a.temperature)}${unit}</div>
          </div>
          <div class="w-right">
            ${iconSvg(st.state, night)}
            <div class="w-cond">${LABELS[st.state] || st.state}</div>
            ${today ? `<div class="w-hl">H:${r(today.temperature)}${unit} L:${r(today.templow)}${unit}</div>` : ""}
          </div>
        </div>
        ${hourly.length ? `<div class="w-hours">${hourly.slice(0, 6).map((h, i) => `
          <div class="hour">
            <div class="h-time">${i === 0 ? "Now" : this._fmtHour(h.datetime)}</div>
            <div class="h-icon">${iconSvg(h.condition, this._isNightAt(h.datetime))}</div>
            <div class="h-temp">${r(i === 0 ? a.temperature : h.temperature)}${unit}</div>
          </div>`).join("")}</div>` : ""}
        ` : `
        <div class="hero">
          <div class="place">${this._config.name || a.friendly_name || "Weather"}</div>
          <div class="temp">${r(a.temperature)}${unit}</div>
          <div class="cond">${LABELS[st.state] || st.state}</div>
          ${today ? `<div class="hl">H:${r(today.temperature)}${unit}&nbsp;&nbsp;L:${r(today.templow)}${unit}</div>` : ""}
        </div>
        ${hourly.length ? `<div class="panel">
          <div class="summary">${this._summary(st, this._hourly)}</div>
          <div class="hours">${hoursHtml}</div>
        </div>` : ""}
        ${daily.length ? `<div class="panel">
          <div class="label">${daily.length}-day forecast</div>
          <div class="days">${daysHtml}</div>
        </div>` : ""}
        ${details.length ? `<div class="panel details">${details.map(([k, v]) => `<div class="det"><span class="label">${k}</span><b>${v}</b></div>`).join("")}</div>` : ""}
        `}
        </div>
      </ha-card>`;

    if (!interactive) return;
    const card = this.shadowRoot.querySelector("ha-card");
    // widget → full forecast popup; full layout → Home Assistant more-info
    const open = widget
      ? () => this._openPopup()
      : () => this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    // keep horizontal scroll from opening more-info
    if (!widget) this.shadowRoot.querySelector(".hours")?.addEventListener("click", (e) => e.stopPropagation());
  }
}

if (!customElements.get("sky-weather-card")) customElements.define("sky-weather-card", SkyWeatherCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === "sky-weather-card")) {
  window.customCards.push({ type: "sky-weather-card", name: "Sky Weather Card", description: "Glanceable weather with hourly strip and daily temperature ranges.", preview: true });
}
