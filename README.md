# Sky Weather Card

A calm, glanceable weather card for Home Assistant. It shows a sky that follows the conditions, a large current temperature, an hourly strip, and daily temperature-range bars.

Styling follows Apple's Human Interface Guidelines on charting data and materials. It uses standard thin materials in the content layer, vibrant label levels, a dimming layer over bright skies, and supports Reduce Transparency and Increase Contrast.

## Install

Add a dashboard resource (**Settings → Dashboards → ⋮ → Resources**), type **JavaScript module**:

```
https://cdn.jsdelivr.net/gh/legogit007/sky-weather-card@v1.2.0/sky-weather-card.js
```

Or copy `sky-weather-card.js` to `/config/www/` and use `/local/sky-weather-card.js`.

## Use

```yaml
type: custom:sky-weather-card
entity: weather.forecast_home
name: Home      # optional
layout: widget  # optional: "widget" (compact tile) or "full" (default)
hours: 12       # optional, hourly items
days: 7         # optional, daily rows
tap_action: none  # optional, disables tapping
hourly_entity: weather.your_town_hourly  # optional, for providers like BoM that split hourly forecasts
```

**Widget layout** is a compact tile with the place, temperature, condition, H/L and the next six hours. Tapping it opens the full forecast in a popup. Close the popup with ✕, Escape, or a tap outside it. **More details** in the popup opens Home Assistant's standard weather dialog.

**Full layout** shows the whole forecast in place. Tapping it opens Home Assistant's standard weather dialog.

The card reads forecasts with `weather/subscribe_forecast`, so any weather integration that supports hourly and daily forecasts works. The day/night sky uses `sun.sun`.

## License

MIT
