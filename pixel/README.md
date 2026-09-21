# Moosklinge

Ein 2D-Pixel-Art-Jump-and-Run im Browser: drei handgebaute Zonen, Schwertkampf,
Stampf-Angriffe, fahrende Plattformen, Beute zum Einsammeln und eine Punktewertung
mit Zeitbonus.

**Alles ist Code** — es gibt keine Bilddateien, keine Sounddateien und keine
externen Bibliotheken. Jeder Sprite ist ein Zeichenraster in `src/sprites.js`,
jede Kachel wird prozedural gemalt (`src/tiles.js`), der Hintergrund entsteht aus
gesäten Zufallszahlen (`src/scenery.js`) und die Musik kommt aus einem kleinen
Step-Sequencer auf der WebAudio-API (`src/audio.js`).

## Starten

**Direkt öffnen:** `pixel/index.html` im Browser doppelklicken — funktioniert offline.

**Oder lokal servieren:**

```bash
python3 -m http.server 8000
# dann http://localhost:8000/pixel/ öffnen
```

## Steuerung

| Taste | Aktion |
|---|---|
| `←` `→` oder `A` `D` | Laufen |
| `Leertaste`, `W`, `↑` oder `Z` | Springen (je länger gedrückt, desto höher) |
| `J`, `X` oder `K` | Schwerthieb |
| `P` oder `Esc` | Pause |
| `R` | Zone neu starten |
| `M` | Ton an/aus |
| `Enter` / `Leertaste` | Menüs bestätigen |

Auf Handy und Tablet blendet sich automatisch ein Touch-Pad ein.

## Spielprinzip

* **3 Herzen.** Gegnerberührung und Stacheln kosten eins, danach bist du kurz unverwundbar.
* **Zwei Wege, Gegner zu erledigen:** Schwerthieb oder von oben draufspringen (gibt einen Abpraller).
* **Beute:** Münze 10 Punkte, Kristall 50, Herz heilt (oder gibt 25 Punkte bei voller Leiste).
* **Zonenende:** die Fahne. Es gibt einen Zeitbonus und 250 Extrapunkte, wenn du alles eingesammelt hast.
* **Stürze** setzen die Zone zurück, die Punkte fallen auf den Stand vom Zonenstart.
* Der beste Durchlauf landet im `localStorage`.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/util.js` | Mathe-Helfer, gesäter Zufall (Mulberry32), Canvas-Fabrik |
| `src/font.js` | 5×7-Bitmap-Font, Zeile für Zeile gesetzt |
| `src/sprites.js` | Held, Schleim, Fledermaus, Beute, Schwert, Hieb als Zeichenraster |
| `src/tiles.js` | Kachelsätze für Wald, Höhle und Ruine (Rauschen + Kantenlichter) |
| `src/scenery.js` | Drei Parallax-Ebenen je Thema |
| `src/audio.js` | Chiptune-Effekte und ein 16tel-Sequencer für die Musik |
| `src/input.js` | Tastatur und Touch, mit Flankenerkennung |
| `src/levels.js` | Die drei Zonen als ASCII-Karten |
| `src/world.js` | Karte → Kachelgitter, Kollisionsabfragen, Kachel-Rendering |
| `src/entities.js` | Gegner, Beute, fahrende Plattformen, Partikel |
| `src/player.js` | Bewegung, Sprunggefühl, Kampf, Trefferphasen |
| `src/game.js` | Zustandsautomat, feste Zeitschritte, Kamera, HUD, Menüs |

## Eigene Level bauen

Level sind Textzeilen in `src/levels.js`. Die senkrechten Striche sind nur
Lesehilfen (alle 8 Spalten) und werden beim Laden entfernt.

| Zeichen | Bedeutung |
|---|---|
| `#` | fester Block |
| `=` | Plattform, nur von oben begehbar |
| `^` | Stacheln |
| `o` `*` `h` | Münze, Kristall, Herz |
| `s` `b` | Schleim, Fledermaus |
| `M` `V` | fahrende Plattform (waagerecht / senkrecht) |
| `P` `F` | Startpunkt, Ziel-Fahne |
| `.` | Luft |

Die Reichweite der fahrenden Plattformen ergibt sich automatisch aus dem freien
Raum daneben bzw. darüber. Ein neues Level einfach als weiteren Eintrag in
`PX.levels` anhängen — Thema (`forest`, `cave`, `ruin`) und Musikspur (`0`–`2`)
dazu, fertig.

## Sprunghöhe im Überblick

Beim Umbauen der Level hilft diese Faustregel (Werte aus `src/player.js`):

* Laufgeschwindigkeit 104 px/s, Sprungimpuls 290 px/s, Schwerkraft 900 px/s²
* Scheitelhöhe ≈ 47 px (knapp 3 Kacheln), Sprungweite eben ≈ 67 px (gut 4 Kacheln)
* Eine Kachel höher landen kostet Weite: ≈ 61 px, zwei Kacheln höher ≈ 52 px

Lücken von drei Kacheln sind also machbar, vier sind es nur bergab.
