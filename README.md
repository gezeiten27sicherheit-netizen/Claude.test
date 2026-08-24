# Hyrule Craft

Ein Browser-Spiel, das **Zelda: Tears of the Kingdom** mit **Minecraft** verschmilzt:
eine prozedural generierte Voxelwelt zum Abbauen und Bauen, kombiniert mit TOTK-typischer
Bewegung (Ausdauer, Wände erklettern, Gleitschirm) und dem Fusions-Kampfsystem.

Reines Vanilla-JavaScript + [three.js](https://threejs.org/) (lokal mitgeliefert unter
`vendor/`) — kein Build-Schritt, keine externen Requests zur Laufzeit.

## Starten

**Option A – direkt öffnen:** `index.html` im Browser doppelklicken. Funktioniert offline.

**Option B – lokaler Server** (empfohlen, falls dein Browser Pointer-Lock bei `file://`
einschränkt):

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Steuerung

| Taste | Aktion |
|---|---|
| `WASD` | Bewegen |
| Maus | Umsehen |
| `Leertaste` | Springen · an Wänden hochklettern (halten, Blick zur Wand) |
| `Shift` (in der Luft) | Gleitschirm öffnen · Ausdauer wird verbraucht |
| `Shift` (am Boden) | Sprinten |
| Linksklick | Abbauen / Angreifen (je nachdem, was im Fadenkreuz ist) |
| Rechtsklick | Block platzieren / Essen |
| `1`–`9`, Mausrad | Schnellzugriffsleiste |
| `E` | Inventar |
| `F` | Fusion (zwei Gegenstände zu neuer Waffe verschmelzen) |
| `Esc` | Maus freigeben |

## Features

- **Prozedurale Voxelwelt** (80×80×40 Blöcke): Hügel, Wasser, Höhlen, Erzadern
  (Eisen/Gold/Zonai-Kristall), Bäume und fünf glühende Schreine mit Beute.
- **Tag/Nacht-Zyklus** mit dynamischem Himmel, Sonne/Mond und Sternen. Nachts spawnen
  Bokoblins, tagsüber friedliche Kühe.
- **TOTK-Bewegung**: Ausdauerrad steuert Sprinten, Klettern und Gleiten; Sturzschaden,
  wenn man ohne Gleitschirm zu tief fällt.
- **Fusion statt Werkbank**: Zwei Gegenstände im Inventar verschmelzen sofort zu einer
  neuen Waffe (z. B. Stock + Stein → Steinschwert, Stock + Zonai-Kristall → Kristallklinge).
  Unbekannte Kombinationen erzeugen improvisierte Fusionswaffen basierend auf ihren Werten.
  Werkzeuge und Waffen nutzen sich ab und zerbrechen.
- Minecraft-typisches Abbauen/Platzieren, Inventar, Herzen-Lebensanzeige.

## Projektstruktur

```
index.html          Einstiegspunkt, UI-Markup
style.css            gesamtes UI-Styling
vendor/three.min.js  three.js r0.158 (lokal, kein CDN nötig)
src/noise.js         seedbasiertes Perlin-Rauschen
src/items.js         Block-/Item-Definitionen, Fusionsrezepte
src/physics.js       AABB-vs-Voxel-Kollision (von Spieler & Mobs geteilt)
src/world.js         Weltgenerierung, Chunk-Meshing, Voxel-Raycasting
src/entities.js      Mobs (Bokoblin, Kuh) + Spawn-Manager
src/player.js         Bewegung, Ausdauer, Klettern, Gleiten, Kampf, Inventar
src/ui.js            HUD, Inventar-/Fusions-Overlay
src/main.js          Szene, Beleuchtung, Tag/Nacht, Input, Game-Loop
```
