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
| `index.html` | Landingpage — Struktur und Inhalte aller Sektionen |
| `style.css` | Design-Tokens, Layout, alle Transitions und Keyframes |
| `script.js` | Scroll-Logik, Canvas-Hintergrund, Syntax-Highlighting |
| `kurs.html` | Interaktiver Kurs — Onboarding, Setup, Lernpfad, Übungen |
| `kurs.css` | Styles des Kurses, baut auf den Tokens aus `style.css` auf |
| `kurs.js` | Maskottchen, Lehrplan, Übungs-Engine, Fortschritt |

## Der Kurs

`kurs.html` führt in fünf Fragen durch das Onboarding und baut daraus einen
Lernpfad. Durch alles begleitet **Kobo**, ein Kobold mit Grasblock-Kappe und
Grubenlampe — als 16×16-Pixelraster in `kurs.js` definiert und zur Laufzeit als
SVG gezeichnet, mit vier Stimmungen (`idle`, `happy`, `sad`, `think`).

### Ablauf

1. **Wo stehst du?** — von „noch gar nicht programmiert" bis „schon
   veröffentlicht". Wer schon veröffentlicht hat, bekommt alle Lektionen sofort
   freigeschaltet, alle anderen arbeiten sich der Reihe nach vor.
2. **Womit willst du bauen?** — Fabric, NeoForge, Forge oder „weiß ich noch
   nicht" (wird zu Fabric).
3. **Wie willst du lernen?** — nur Rätsel im Browser, oder zusätzlich eine
   Aufgabenliste für die IDE.
4. **Mods oder Plugins?**
5. **Ist alles installiert?** — bei „nein" oder „teilweise" geht es zur
   Setup-Checkliste.

Bei **Plugins** wird die Loader-Antwort sichtbar durch Paper ersetzt: Plugins
laufen serverseitig und brauchen keinen Mod-Loader. Der Hinweis steht als Chip
auf dem Lernpfad, damit die Umstellung nachvollziehbar bleibt.

### Setup-Checkliste

Die Liste stellt sich aus der gewählten Plattform zusammen. Ein Klick auf einen
Eintrag öffnet rechts das Detail: wozu das Werkzeug gut ist, ein Link zur
offiziellen Bezugsquelle, die Schritte und — wo sinnvoll — ein Befehl zum
Kopieren. Erst wenn alle Pflicht-Einträge abgehakt sind, öffnet sich der
Lernpfad. Wer will, überspringt das Setup und macht nur die Browser-Rätsel.

### Übungen

Vier Aufgabentypen, definiert als Daten in `kurs.js`:

| Typ | Bedienung |
|---|---|
| `choice` | Eine von vier Antworten — Optionen werden bei jedem Aufruf gemischt |
| `gap` | Wortkacheln in Code-Lücken tippen, Antippen einer Lücke nimmt sie zurück |
| `order` | Zeilen in die richtige Reihenfolge bringen |
| `input` | Freie Eingabe, Vergleich ohne Leerzeichen und Groß-/Kleinschreibung |

Pro Lektion drei Herzen. Jede richtige Antwort gibt 10 XP, das erste Bestehen
einer Lektion zusätzlich 20. Nach jeder Antwort erklärt Kobo, warum sie richtig
oder falsch war — auch bei richtigen Antworten, weil dort der eigentliche
Lerninhalt steckt. Die Lektionen für Item, Blöcke und Events zeigen echten Code
der gewählten Plattform, kein Pseudo-Beispiel.

### Fortschritt

Alles liegt unter dem localStorage-Schlüssel `blockforge.kurs.v1`: Antworten,
abgehakte Werkzeuge, erledigte Lektionen und IDE-Aufgaben, XP und Tagesserie.
Ist der Speicher blockiert (privater Modus), läuft der Kurs trotzdem — dann eben
ohne gespeicherten Fortschritt. „Neu starten" oben rechts löscht alles.

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
