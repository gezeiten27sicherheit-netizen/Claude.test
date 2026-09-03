# BlockForge — Minecraft-Modding-Website

Eine statische Landingpage rund um Minecraft-Modding (Fabric, NeoForge, Forge)
mit durchgehenden Scroll-Animationen. Reines HTML/CSS/JS — kein Build-Schritt,
keine Abhängigkeiten, keine externen Requests zur Laufzeit.

## Starten

`index.html` im Browser öffnen. Oder, falls dir ein Server lieber ist:

```bash
cd website
python3 -m http.server 8000
# http://localhost:8000
```

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Struktur und Inhalte aller Sektionen |
| `style.css` | Design-Tokens, Layout, alle Transitions und Keyframes |
| `script.js` | Scroll-Logik, Canvas-Hintergrund, Syntax-Highlighting |

## Animationen

| Effekt | Umsetzung |
|---|---|
| Hero-Titel | Wortweiser Masken-Reveal mit gestaffeltem Delay |
| Schwebende Blöcke | 2D-Canvas, isometrisch gezeichnet, Parallax auf Maus + Scroll |
| Reveal beim Scrollen | `IntersectionObserver` setzt `.in`, CSS übernimmt den Rest |
| Zähler | `easeOutExpo` über `requestAnimationFrame`, startet bei 60 % Sichtbarkeit |
| Pipeline-Sektion | Sticky-Pin: vertikales Scrollen wird zu horizontaler Bewegung, mit Lerp geglättet |
| Fortschrittslinie | Timeline füllt sich anhand ihrer Position im Viewport |
| Cursor-Spotlight | Radialer Verlauf, folgt dem Zeiger verzögert (Lerp 0.12) |
| Karten-Tilt | `rotateX/rotateY` aus der Zeigerposition, Glow folgt mit |

### Performance

Alle Scroll-Effekte laufen in **einer** `requestAnimationFrame`-Schleife.
Scroll- und Resize-Listener schreiben nur Werte in ein Zustandsobjekt; Layout-
Messungen (Sektions-Offsets, Track-Breite, Canvas-Größe) sind gecacht und werden
nur nach einem Resize erneuert. Animiert wird ausschließlich über `transform`
und `opacity`.

### Barrierefreiheit

`prefers-reduced-motion: reduce` schaltet Transitions, Keyframes, Parallax und
das Spotlight ab — die Seite bleibt vollständig nutzbar. Die Navigation ist per
Tastatur bedienbar, das FAQ nutzt native `<details>`-Elemente.

## Inhalt anpassen

- **Farben:** die Custom Properties in `:root` (`style.css`) — `--green`,
  `--cyan`, `--orange` steuern alle Akzente.
- **Pipeline-Schritte:** weitere `<article class="step">` in `#pin-track`
  ergänzen; die Scrollstrecke berechnet sich automatisch aus der Track-Breite.
- **Code-Beispiele:** neuen `<pre class="pane" data-pane="xyz">` plus passenden
  `<button class="tab" data-tab="xyz">` hinzufügen — der Highlighter greift
  automatisch.

---

Fan-Projekt. Nicht mit Mojang oder Microsoft verbunden.
