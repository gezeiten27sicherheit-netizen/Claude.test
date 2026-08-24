# Hyrule Craft

Ein Browser-Spiel, das **Zelda: Tears of the Kingdom** mit **Minecraft** verschmilzt:
eine unendliche, prozedural generierte Voxelwelt zum Abbauen und Bauen (Chunk-System wie
bei Minecraft), kombiniert mit TOTK-Fähigkeiten — Fusion, Ultrahand, Ascend, Recall und
Gleitschirm — auf handgezeichneten Pixel-Art-Texturen mit dezenten, performanten Shader-Effekten.

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

Alle Tasten sind über das Einstellungsmenü (⚙️ oben rechts, oder Taste `O`) frei belegbar.
Standardbelegung:

| Taste | Aktion |
|---|---|
| `WASD` | Bewegen |
| Maus | Umsehen |
| `Leertaste` | Springen · an Wänden hochklettern (halten, Blick zur Wand) |
| `Shift` (in der Luft) | Gleitschirm öffnen · Ausdauer wird verbraucht |
| `Shift` (am Boden) | Sprinten |
| Linksklick | Abbauen / Angreifen (je nachdem, was im Fadenkreuz ist) |
| Rechtsklick | Block platzieren / Essen |
| `G` | **Ultrahand** — Objekt/Block greifen, bewegen, wieder anbringen |
| `C` | **Ascend** — durch eine Decke nach oben auftauchen |
| `R` | **Recall** — ein bewegtes/gefallenes Objekt zeitlich zurückspulen |
| `1`–`9`, Mausrad | Schnellzugriffsleiste |
| `E` | Inventar |
| `F` | Fusion (zwei Gegenstände zu neuer Waffe verschmelzen) |
| `O` | Einstellungen |
| `Esc` | Maus freigeben |

## Features

- **Unendliche Voxelwelt**: Minecraft-typisches Chunk-System (16×16-Spalten), das rund um
  den Spieler dynamisch geladen/entladen wird. Abbau- und Bauänderungen bleiben dauerhaft
  gespeichert, auch wenn ein Chunk entladen und später neu geladen wird. Wahlweise auf eine
  begrenzte Insel einschränkbar (Einstellungen → „Unendliche Welt“).
- **Handgezeichnete Pixel-Art-Texturen**: ein eigener, zur Laufzeit generierter Textur-Atlas
  (kein Vanilla-Recolor) mit Ecken-Ambient-Occlusion für plastische Tiefe.
- **Dezente, performante Shader**: sanft wogendes Wasser, pulsierende Glühblöcke (Fackeln,
  Kristalle, Schreinkerne), filmisches Tonemapping — bewusst leichtgewichtig, kein
  Post-Processing-Overhead.
- **Tag/Nacht-Zyklus** mit dynamischem Himmel, Sonne/Mond und Sternen. Nachts spawnen
  Bokoblins, tagsüber friedliche Kühe.
- **TOTK-Fähigkeiten als eigenständige Skills**, jede einzeln umschaltbar:
  - **Fusion** — zwei Gegenstände verschmelzen sofort zu einer neuen Waffe (z. B. Stock +
    Stein → Steinschwert, Stock + Zonai-Kristall → Kristallklinge); unbekannte Kombinationen
    erzeugen improvisierte Fusionswaffen aus ihren Werten.
  - **Ultrahand** — Blöcke aus der Welt greifen, durch die Luft tragen und an neuer Stelle
    wieder andocken, um eigene Konstruktionen zu bauen.
  - **Ascend** — durch eine Decke über einem nach oben phasen und obenauf auftauchen.
  - **Recall** — die Bewegungshistorie eines (mit Ultrahand bewegten oder heruntergefallenen)
    Objekts abspielen und es zeitlich zurückspulen.
  - **Gleitschirm** — Ausdauerrad steuert Sprinten, Klettern und Gleiten; Sturzschaden, wenn
    man ohne Gleitschirm zu tief fällt.
- Minecraft-typisches Abbauen/Platzieren, Inventar, Herzen-Lebensanzeige.
- **Umfangreiches Einstellungsmenü**: jede Fähigkeit (Abbauen, Platzieren, Kampf, Sturzschaden,
  Tag/Nacht, Mob-Spawns, Fusion, Ultrahand, Ascend, Recall, Gleitschirm, Klettern, unendliche
  Welt) einzeln an-/abschaltbar, Grafik-Optionen (Sichtweite, Ambient Occlusion, Shader) und
  freie Tastenbelegung für jede Aktion — alles wird in `localStorage` gespeichert.

## Projektstruktur

```
index.html           Einstiegspunkt, UI-Markup
style.css             gesamtes UI-Styling
vendor/three.min.js   three.js r0.158 (lokal, kein CDN nötig)
src/config.js         Einstellungen: Feature-Toggles, Grafik, Tastenbelegung (localStorage)
src/input.js          Aktionsbasierte Input-Abstraktion inkl. Live-Rebinding
src/noise.js          seedbasiertes Perlin-Rauschen
src/items.js           Block-/Item-Definitionen, Fusionsrezepte
src/textures.js        prozeduraler Pixel-Art-Textur-Atlas (eigene Assets)
src/physics.js         AABB-vs-Voxel-Kollision (von Spieler, Mobs & Props geteilt)
src/world.js            unendliches Chunk-System, Generierung, Meshing (Textur+AO), Raycasting
src/entities.js         Mobs (Bokoblin, Kuh) + Spawn-Manager
src/props.js            Ultrahand-/Recall-Objekte (greifbar, bewegbar, mit Bewegungshistorie)
src/player.js           Bewegung, Ausdauer, Fähigkeiten, Kampf, Inventar
src/ui.js               HUD, Inventar-/Fusions-/Einstellungs-Overlay
src/main.js             Szene, Beleuchtung, Tag/Nacht, Input-Verdrahtung, Game-Loop
```
