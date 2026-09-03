/* ==========================================================================
   BlockForge Kurs
   Onboarding → Setup-Checkliste → Lernpfad → Übungen.
   Vanilla JS, Fortschritt liegt in localStorage.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const today = () => new Date().toISOString().slice(0, 10);

  /* ══════════════════════════════════════════════════════════════════
     Speicher
     ══════════════════════════════════════════════════════════════════ */
  const KEY = 'blockforge.kurs.v1';
  const blank = () => ({
    onboarded: false,
    answers: {},
    setup: [],
    setupSkipped: false,
    done: {},
    tasks: [],
    xp: 0,
    streak: 0,
    lastDay: null,
  });

  let S = blank();

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) S = Object.assign(blank(), JSON.parse(raw));
    } catch (e) {
      /* Privater Modus oder blockierter Speicher — dann eben ohne Fortschritt. */
    }
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) { /* nicht schlimm, die Sitzung läuft trotzdem */ }
  };

  /* ══════════════════════════════════════════════════════════════════
     Kobo — das Maskottchen
     Ein Kobold aus dem Minenschacht: Grasblock-Kappe, Grubenlampe,
     gezeichnet als 16×16-Pixelraster.
     ══════════════════════════════════════════════════════════════════ */
  const PIX = {
    G: '#7ddc5b', g: '#4d9c38',
    D: '#a97a53', d: '#7d5334',
    W: '#f2f7f3', K: '#17211a', k: '#17211a',
    Y: '#ffd479',
  };

  const KOBO_BASE = [
    '......YY........',
    '.....YYYY.......',
    '....GGGGGGGG....',
    '...GGGGGGGGGG...',
    '..GGGGGGGGGGGG..',
    '..GgGGGGGGGGgG..',
    '..DDDDDDDDDDDD..',
    '..DWWDDDDDDWWD..',
    '..DWKDDDDDDKWD..',
    '..DDDDDDDDDDDD..',
    '..DDDDkkkkDDDD..',
    '..DdDDDDDDDDdD..',
    '..DDDDDDDDDDDD..',
    '..dddddddddddd..',
    '...dd......dd...',
    '................',
  ];

  const MOODS = {
    idle: {},
    happy: {
      10: '..DDkDDDDDDkDD..',
      11: '..DDDkkkkkkDDD..',
    },
    sad: {
      8:  '..DWKDDDDDDKWD..',
      10: '..DDDkkkkkkDDD..',
      11: '..DDkDDDDDDkDD..',
    },
    think: {
      7:  '..DWWDDDDDDkkD..',
      8:  '..DWKDDDDDDDDD..',
      10: '..DDDDDkkDDDDD..',
    },
  };

  const koboSvg = (mood = 'idle') => {
    const rows = KOBO_BASE.map((r, i) => (MOODS[mood] && MOODS[mood][i]) || r);
    let rects = '';
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x];
        if (c === '.') { x++; continue; }
        let w = 1;
        while (x + w < row.length && row[x + w] === c) w++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + PIX[c] + '"/>';
        x += w;
      }
    });
    return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="Kobo">' + rects + '</svg>';
  };

  const setKobo = (node, mood, anim) => {
    if (!node) return;
    node.innerHTML = koboSvg(mood);
    if (anim) {
      node.classList.remove('kobo-bounce', 'kobo-shake');
      void node.offsetWidth;
      node.classList.add(anim);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     Onboarding — die fünf Fragen
     ══════════════════════════════════════════════════════════════════ */
  const QUESTIONS = [
    {
      id: 'level',
      bubble: 'Erstmal: wo stehst du gerade? Ehrlich sein lohnt sich — davon hängt ab, wo dein Pfad anfängt.',
      q: 'Wie viel hast du schon programmiert?',
      sub: 'Es geht um Programmieren allgemein und um Minecraft im Speziellen.',
      options: [
        { v: 'none', ico: '🌱', t: 'Noch gar nicht', d: 'Ich fange bei null an.' },
        { v: 'basics', ico: '📘', t: 'Java-Grundlagen sitzen', d: 'Klassen, Methoden, Variablen sagen mir was.' },
        { v: 'tried', ico: '🔧', t: 'Schon mal was gemoddet', d: 'Ein Item oder Block hat es schon ins Spiel geschafft.' },
        { v: 'shipped', ico: '🚀', t: 'Habe schon veröffentlicht', d: 'Ein Mod von mir liegt auf Modrinth oder CurseForge.' },
      ],
    },
    {
      id: 'loader',
      bubble: 'Womit willst du bauen? Falls du unsicher bist: nimm Fabric, der Einstieg ist am kleinsten.',
      q: 'Womit willst du programmieren?',
      sub: 'Bestimmt deine Mappings, dein Template und die Beispiele im Kurs.',
      options: [
        { v: 'fabric', ico: '🧵', t: 'Fabric', d: 'Leichtgewichtig, schnelle Updates, viel Mixin.' },
        { v: 'neoforge', ico: '⚒️', t: 'NeoForge', d: 'Große API, Events, Registries — für Content-Mods.' },
        { v: 'forge', ico: '🏛️', t: 'Forge', d: 'Ältere Versionen, 1.12 bis 1.20.' },
        { v: 'unsure', ico: '🤷', t: 'Weiß ich noch nicht', d: 'Dann leihe ich dir meine Meinung: Fabric.' },
      ],
    },
    {
      id: 'mode',
      bubble: 'Willst du nur hier im Browser knobeln, oder parallel ein echtes Projekt aufmachen?',
      q: 'Wie willst du lernen?',
      sub: 'Du kannst das später jederzeit umstellen.',
      options: [
        { v: 'browser', ico: '🧩', t: 'Nur Rätsel im Browser', d: 'Kein Download, überall zwischendurch.' },
        { v: 'both', ico: '💻', t: 'Rätsel plus echtes Projekt', d: 'Zu jeder Lektion eine Aufgabe in der IDE.' },
      ],
    },
    {
      id: 'target',
      bubble: 'Und was soll am Ende dabei rauskommen?',
      q: 'Mods oder Plugins?',
      sub: 'Mods verändern das Spiel selbst und laufen bei jedem mit. Plugins laufen nur auf dem Server, ohne dass Spieler etwas installieren.',
      options: [
        { v: 'mod', ico: '🧱', t: 'Mods', d: 'Neue Blöcke, Items, Dimensionen — Client und Server.' },
        { v: 'plugin', ico: '🖧', t: 'Plugins', d: 'Serverseitig mit Paper/Spigot, ohne Loader beim Spieler.' },
      ],
    },
    {
      id: 'installed',
      bubble: 'Letzte Frage: hast du das Werkzeug schon auf dem Rechner?',
      q: 'Ist bei dir schon alles installiert?',
      sub: 'JDK, IDE, Git und das passende Template.',
      options: [
        { v: 'yes', ico: '✅', t: 'Ja, alles da', d: 'Direkt zu den Übungen.' },
        { v: 'partly', ico: '🧩', t: 'Teilweise', d: 'Ich hake ab, was noch fehlt.' },
        { v: 'no', ico: '📦', t: 'Nein, noch nichts', d: 'Kobo zeigt dir Stück für Stück, was du brauchst.' },
      ],
    },
  ];

  /* Was bei "Plugins" statt eines Mod-Loaders gilt. */
  const platformOf = () => {
    if (S.answers.target === 'plugin') return 'paper';
    return S.answers.loader === 'unsure' ? 'fabric' : S.answers.loader;
  };
  const PLATFORM_NAME = {
    fabric: 'Fabric', neoforge: 'NeoForge', forge: 'Forge', paper: 'Paper',
  };

  /* ══════════════════════════════════════════════════════════════════
     Setup — was man braucht und wo es herkommt
     ══════════════════════════════════════════════════════════════════ */
  const TOOLS = {
    jdk: {
      name: 'JDK 21',
      short: 'Das Java, gegen das Minecraft gebaut wird',
      why: 'Minecraft 1.20.5 und neuer braucht Java 21. Ein älteres JDK bricht den Build ab, bevor irgendetwas kompiliert.',
      url: 'https://adoptium.net/temurin/releases/',
      urlText: 'adoptium.net — Temurin 21 (LTS)',
      steps: [
        'Auf der Seite Version <b>21 – LTS</b> wählen, dazu dein Betriebssystem.',
        'Paket-Typ <b>JDK</b> nehmen, nicht JRE — nur das JDK kann kompilieren.',
        'Installer ausführen und den Haken bei „Set JAVA_HOME variable" setzen.',
        'Terminal neu öffnen und prüfen: die Ausgabe muss mit 21 anfangen.',
      ],
      cmd: 'java -version',
    },
    idea: {
      name: 'IntelliJ IDEA Community',
      short: 'Der Editor, in dem du schreibst',
      why: 'Die Community-Edition ist kostenlos und kann alles, was du brauchst: Gradle-Import, Debugger, Refactoring.',
      url: 'https://www.jetbrains.com/idea/download/',
      urlText: 'jetbrains.com — IDEA Community Edition',
      steps: [
        'Auf der Download-Seite nach unten scrollen zu <b>Community Edition</b> — die obere, große Schaltfläche ist die kostenpflichtige Ultimate.',
        'Installieren und beim ersten Start das Standard-Layout übernehmen.',
        'Später das Projekt über <b>Open</b> öffnen und auf den Gradle-Import warten.',
      ],
    },
    git: {
      name: 'Git',
      short: 'Versionsverwaltung',
      why: 'Templates werden per Git geklont, und du willst deinen Code sichern können, bevor ein Experiment ihn zerlegt.',
      url: 'https://git-scm.com/downloads',
      urlText: 'git-scm.com — Downloads',
      steps: [
        'Installer für dein System laden und mit den Standardeinstellungen durchlaufen lassen.',
        'Danach im Terminal die Version prüfen.',
      ],
      cmd: 'git --version',
    },
    mc: {
      name: 'Minecraft Java Edition',
      short: 'Zum Ausprobieren',
      why: 'Der Dev-Client von Fabric und NeoForge startet ein eigenes Minecraft — dafür brauchst du einen Account mit gekaufter Java Edition.',
      url: 'https://www.minecraft.net/de-de/store/minecraft-deluxe-collection-pc',
      urlText: 'minecraft.net — Java Edition',
      steps: [
        'Java-Edition-Account einloggen, einmal im Launcher starten.',
        'Die Version installieren, für die du moddest — die Zielversion deines Templates.',
      ],
    },
    tplFabric: {
      name: 'Fabric Beispiel-Mod',
      short: 'Dein Projektgerüst',
      why: 'Der Template-Generator baut dir ein fertiges Gradle-Projekt mit Mod-ID, Einstiegsklasse und fabric.mod.json.',
      url: 'https://fabricmc.net/develop/template/',
      urlText: 'fabricmc.net — Template Mod Generator',
      steps: [
        'Mod-Name, Paketname und Minecraft-Version eintragen.',
        '<b>Mojmap</b> oder <b>Yarn</b> wählen — als Anfänger Yarn, die Namen sind sprechender.',
        'ZIP herunterladen, entpacken, Ordner in IntelliJ über <b>Open</b> öffnen.',
        'Ersten Build laufen lassen. Der erste dauert ein paar Minuten, danach Sekunden.',
      ],
      cmd: './gradlew build',
    },
    tplNeo: {
      name: 'NeoForge MDK',
      short: 'Dein Projektgerüst',
      why: 'Das Mod Development Kit ist das offizielle Startprojekt: Gradle-Setup, Beispielklasse und neoforge.mods.toml sind drin.',
      url: 'https://neoforged.net/',
      urlText: 'neoforged.net — MDK herunterladen',
      steps: [
        'Auf der Startseite zur aktuellen Version und das <b>MDK</b> als ZIP laden.',
        'Entpacken und in IntelliJ über <b>Open</b> die Datei <b>build.gradle</b> öffnen.',
        'In <b>gradle.properties</b> Mod-ID, Name und Gruppe auf deine Werte ändern.',
        'Build starten und den Dev-Client testen.',
      ],
      cmd: './gradlew runClient',
    },
    tplForge: {
      name: 'Forge MDK',
      short: 'Dein Projektgerüst',
      why: 'Für ältere Versionen liefert Forge ein MDK-ZIP passend zur jeweiligen Minecraft-Version.',
      url: 'https://files.minecraftforge.net/',
      urlText: 'files.minecraftforge.net — MDK',
      steps: [
        'Links die Minecraft-Version wählen, dann <b>Mdk</b> herunterladen.',
        'Entpacken, in IntelliJ öffnen und den Gradle-Import abwarten.',
        'In <b>gradle.properties</b> und <b>mods.toml</b> die Mod-ID anpassen.',
      ],
      cmd: './gradlew genIntellijRuns',
    },
    tplPaper: {
      name: 'Paper-Server + Projekt',
      short: 'Server und Plugin-Projekt',
      why: 'Plugins brauchen keinen Loader beim Spieler, aber einen Server zum Testen. Paper ist der verbreitetste.',
      url: 'https://docs.papermc.io/paper/dev/getting-started/project-setup/',
      urlText: 'docs.papermc.io — Project Setup',
      steps: [
        'Der Anleitung folgen und ein Gradle-Projekt mit der Paper-API anlegen.',
        'Von <b>papermc.io/downloads</b> die Server-JAR in einen leeren Ordner legen.',
        'Server einmal starten, EULA akzeptieren, dann liegt ein <b>plugins/</b>-Ordner bereit.',
        'Deine gebaute JAR aus <b>build/libs/</b> dorthin kopieren und den Server neu starten.',
      ],
      cmd: 'java -Xmx2G -jar paper.jar nogui',
    },
    blockbench: {
      name: 'Blockbench',
      short: 'Modelle und Texturen',
      optional: true,
      why: 'Für eigene Block- und Entity-Modelle. Für die ersten Lektionen reicht ein 16×16-Bild, aber irgendwann willst du das hier.',
      url: 'https://blockbench.net/',
      urlText: 'blockbench.net',
      steps: [
        'Als Desktop-App laden oder direkt im Browser benutzen.',
        'Beim Anlegen den Typ <b>Minecraft Block/Item</b> wählen, damit die Exporte passen.',
      ],
    },
  };

  const requiredTools = () => {
    const p = platformOf();
    const base = ['jdk', 'idea', 'git'];
    if (p === 'paper') return base.concat(['tplPaper']);
    base.push('mc');
    if (p === 'neoforge') base.push('tplNeo');
    else if (p === 'forge') base.push('tplForge');
    else base.push('tplFabric');
    return base;
  };
  const allTools = () => requiredTools().concat(['blockbench']);

  /* ══════════════════════════════════════════════════════════════════
     Lehrplan
     Aufgabentypen: choice | gap | order | input
     ══════════════════════════════════════════════════════════════════ */

  /* Loader-abhängige Bausteine, damit die Übungen echten Code zeigen. */
  const L = {
    fabric: {
      entry: 'ModInitializer',
      entryMethod: 'onInitialize',
      meta: 'fabric.mod.json',
      regLine: 'Registry.register(Registries.ITEM, Identifier.of(MOD_ID, "ruby"), RUBY);',
      itemNew: 'new Item(new Item.Settings())',
      settings: 'Item.Settings',
      bus: 'Fabric API Events',
    },
    neoforge: {
      entry: '@Mod',
      entryMethod: 'Konstruktor der Mod-Klasse',
      meta: 'neoforge.mods.toml',
      regLine: 'public static final DeferredItem<Item> RUBY = ITEMS.registerSimpleItem("ruby");',
      itemNew: 'new Item(new Item.Properties())',
      settings: 'Item.Properties',
      bus: 'IEventBus',
    },
    forge: {
      entry: '@Mod',
      entryMethod: 'Konstruktor der Mod-Klasse',
      meta: 'mods.toml',
      regLine: 'public static final RegistryObject<Item> RUBY = ITEMS.register("ruby", () -> new Item(new Item.Properties()));',
      itemNew: 'new Item(new Item.Properties())',
      settings: 'Item.Properties',
      bus: 'MinecraftForge.EVENT_BUS',
    },
  };

  const unitJava = () => ({
    id: 'java',
    title: 'Java, das Nötigste',
    sub: 'Klassen, Typen, Methoden — die Sprache, in der Minecraft geschrieben ist.',
    ex: [
      {
        type: 'choice',
        kind: 'Grundlagen',
        q: 'Was ist in Java eine Klasse?',
        options: [
          'Ein Bauplan, aus dem Objekte entstehen',
          'Eine Datei mit Einstellungen',
          'Ein anderes Wort für Variable',
          'Ein Ordner im Projekt',
        ],
        answer: 0,
        why: 'Eine Klasse beschreibt, welche Daten ein Objekt hat und was es kann. `new Item(...)` erzeugt daraus ein konkretes Objekt.',
      },
      {
        type: 'choice',
        kind: 'Typen',
        q: 'Welcher Typ passt für „Anzahl Items im Stapel"?',
        options: ['String', 'int', 'boolean', 'double'],
        answer: 1,
        why: '`int` ist eine ganze Zahl. Stapelgrößen sind immer ganzzahlig — 3,5 Diamanten gibt es nicht.',
      },
      {
        type: 'gap',
        kind: 'Methoden',
        q: 'Vervollständige die Methode, die nichts zurückgibt.',
        template: 'public ___ init() {\n    System.out.println("Hallo");\n}',
        tiles: ['void', 'int', 'return', 'String'],
        answers: ['void'],
        why: '`void` heißt: diese Methode liefert keinen Wert zurück. Registrier-Methoden in Mods sind fast alle `void`.',
      },
      {
        type: 'choice',
        kind: 'Sichtbarkeit',
        q: 'Was bedeutet `public static final` vor einem Feld?',
        options: [
          'Überall sichtbar, gehört zur Klasse, kann nicht neu zugewiesen werden',
          'Nur in dieser Klasse sichtbar und veränderbar',
          'Wird beim Speichern automatisch gesetzt',
          'Läuft nur auf dem Server',
        ],
        answer: 0,
        why: 'Genau diese Kombination steht vor fast jedem registrierten Item: von außen lesbar, existiert einmal, zeigt immer auf dasselbe Objekt.',
      },
      {
        type: 'order',
        kind: 'Struktur',
        q: 'Bring die Datei in die richtige Reihenfolge.',
        lines: [
          'package dev.example.mod;',
          'import net.minecraft.item.Item;',
          'public class ModItems {',
          '    public static void init() { }',
          '}',
        ],
        why: 'Erst das Paket, dann die Importe, dann die Klasse. Diese Reihenfolge schreibt Java vor — sie ist nicht Geschmackssache.',
      },
    ],
  });

  const unitSetup = (p) => ({
    id: 'setup',
    title: 'Projekt & Gradle',
    sub: 'Wie aus einem Ordner voller Dateien ein Mod wird.',
    ex: [
      {
        type: 'choice',
        kind: 'Build',
        q: 'Was macht `./gradlew build`?',
        options: [
          'Startet Minecraft mit deinem Mod',
          'Kompiliert dein Projekt und legt eine JAR unter build/libs/ ab',
          'Lädt Minecraft herunter',
          'Veröffentlicht den Mod auf Modrinth',
        ],
        answer: 1,
        why: 'Das Ergebnis liegt danach in `build/libs/`. Diese JAR ist es, die in den `mods/`-Ordner kommt.',
      },
      {
        type: 'choice',
        kind: 'Metadaten',
        q: 'In welcher Datei stehen Name, Version und Einstiegspunkt deines Projekts?',
        options: p === 'paper'
          ? ['plugin.yml', 'build.gradle', 'settings.gradle', 'server.properties']
          : [L[p].meta, 'build.gradle', 'settings.gradle', 'options.txt'],
        answer: 0,
        why: p === 'paper'
          ? 'Ohne `plugin.yml` erkennt der Server deine JAR gar nicht als Plugin.'
          : 'In `' + L[p].meta + '` steht, wie dein Mod heißt und welche Klasse gestartet wird.',
      },
      {
        type: 'choice',
        kind: 'Fehlersuche',
        q: 'Der Build bricht ab mit „invalid source release: 21". Was ist los?',
        options: [
          'Das Projekt läuft mit einem zu alten JDK',
          'Minecraft ist nicht installiert',
          'Die Mod-ID enthält Großbuchstaben',
          'Der Ordner liegt auf einem anderen Laufwerk',
        ],
        answer: 0,
        why: 'Gradle benutzt ein JDK, das älter als 21 ist. In IntelliJ unter Settings → Build Tools → Gradle das richtige JDK wählen.',
      },
      {
        type: 'input',
        kind: 'Mod-ID',
        q: 'Welche dieser Mod-IDs ist gültig? Tippe sie ab.',
        hint: 'Zur Auswahl: RubyMod · ruby_mod · ruby-mod!',
        answers: ['ruby_mod'],
        why: 'Mod-IDs bestehen aus Kleinbuchstaben, Ziffern und Unterstrichen. Großbuchstaben und Sonderzeichen fliegen raus.',
      },
    ],
  });

  const unitItem = (p) => ({
    id: 'item',
    title: 'Dein erstes Item',
    sub: 'Registrieren, benennen, Textur dranhängen.',
    ex: [
      {
        type: 'choice',
        kind: 'Registry',
        q: 'Warum muss ein Item registriert werden?',
        options: [
          'Damit das Spiel es unter einer festen ID kennt und speichern kann',
          'Damit es im Kreativmenü ganz oben steht',
          'Weil Gradle das verlangt',
          'Nur bei Items mit eigener Textur nötig',
        ],
        answer: 0,
        why: 'Die Registry ordnet jedem Item eine ID wie `ruby_mod:ruby` zu. Ohne sie kann das Spiel dein Item weder speichern noch über das Netzwerk schicken.',
      },
      {
        type: 'choice',
        kind: 'Zeitpunkt',
        q: 'Wann muss registriert werden?',
        options: [
          'Beim Start des Spiels, bevor eine Welt geladen wird',
          'Erst wenn der Spieler das Item zum ersten Mal braucht',
          'Nach dem Betreten der Welt',
          'Bei jedem Tick neu',
        ],
        answer: 0,
        why: 'Registries frieren ein, sobald eine Welt lädt. Später registrieren wirft eine Exception.',
      },
      {
        type: 'gap',
        kind: 'Code',
        q: 'Ergänze die Registrierung.',
        template: p === 'fabric'
          ? 'Registry.register(Registries.___, Identifier.of(MOD_ID, "___"), RUBY);'
          : 'public static final ___<Item> ITEMS =\n    DeferredRegister.create(Registries.ITEM, "___");',
        tiles: p === 'fabric'
          ? ['ITEM', 'BLOCK', 'ruby', 'Ruby']
          : ['DeferredRegister', 'Registry', 'ruby_mod', 'RubyMod'],
        answers: p === 'fabric' ? ['ITEM', 'ruby'] : ['DeferredRegister', 'ruby_mod'],
        why: p === 'fabric'
          ? 'Die Item-Registry heißt `Registries.ITEM`, und der Pfad einer ID ist immer klein geschrieben.'
          : 'Der `DeferredRegister` sammelt deine Einträge und meldet sie an, wenn der Loader danach fragt.',
      },
      {
        type: 'choice',
        kind: 'Assets',
        q: 'Dein Item ist schwarz-lila kariert. Was fehlt?',
        options: [
          'Das Modell oder die Textur unter dem passenden Pfad',
          'Die Registrierung',
          'Ein Eintrag in der Loot-Table',
          'Ein Neustart von Gradle',
        ],
        answer: 0,
        why: 'Schwarz-lila ist Minecrafts „Textur nicht gefunden". Datei- und Ordnername müssen exakt zur ID passen — auch die Groß- und Kleinschreibung.',
      },
      {
        type: 'input',
        kind: 'Sprachdatei',
        q: 'Unter welchem Schlüssel steht der Anzeigename für das Item `ruby` des Mods `ruby_mod`?',
        hint: 'Format: art.modid.name',
        answers: ['item.ruby_mod.ruby'],
        why: 'In `en_us.json` bzw. `de_de.json` steht `"item.ruby_mod.ruby": "Rubin"`. Fehlt der Eintrag, zeigt das Spiel den Schlüssel selbst an.',
      },
    ],
  });

  const unitBlock = () => ({
    id: 'block',
    title: 'Blöcke & Blockstates',
    sub: 'Ein Block ist mehr als ein Item mit Kanten.',
    ex: [
      {
        type: 'choice',
        kind: 'Grundlagen',
        q: 'Du hast einen Block registriert, aber er taucht im Inventar nicht auf. Warum?',
        options: [
          'Zu einem Block gehört ein eigenes BlockItem, das separat registriert wird',
          'Blöcke erscheinen nie im Inventar',
          'Die Registry war voll',
          'Es fehlt eine Loot-Table',
        ],
        answer: 0,
        why: 'Block und BlockItem sind zwei Dinge: der Block steht in der Welt, das BlockItem liegt in der Hand.',
      },
      {
        type: 'choice',
        kind: 'Blockstate',
        q: 'Wofür ist ein Blockstate da?',
        options: [
          'Für Varianten desselben Blocks, etwa Richtung oder an/aus',
          'Für die Härte des Blocks',
          'Für den Namen im Kreativmenü',
          'Für das Rezept',
        ],
        answer: 0,
        why: 'Eine Truhe kennt vier Richtungen, ein Redstone-Lampe an und aus — alles Blockstates desselben Blocks.',
      },
      {
        type: 'order',
        kind: 'Reihenfolge',
        q: 'In welcher Reihenfolge entsteht ein abbaubarer Block?',
        lines: [
          'Block registrieren',
          'BlockItem registrieren',
          'Blockstate- und Modell-JSON anlegen',
          'Loot-Table anlegen, damit er etwas fallen lässt',
        ],
        why: 'Ohne Loot-Table verschwindet der Block beim Abbauen spurlos — ein Klassiker beim ersten eigenen Erz.',
      },
      {
        type: 'choice',
        kind: 'Abbau',
        q: 'Dein Block lässt sich mit der Hand sofort abbauen, obwohl er wie Stein aussehen soll. Was fehlt?',
        options: [
          'Härte und das passende Werkzeug-Tag',
          'Eine Textur',
          'Ein Eintrag in der Sprachdatei',
          'Ein Rezept',
        ],
        answer: 0,
        why: 'Härte legst du bei den Block-Einstellungen fest, das nötige Werkzeug über Tags wie `mineable/pickaxe`.',
      },
    ],
  });

  const unitEvents = (p) => ({
    id: 'events',
    title: 'Events & Mixins',
    sub: 'Auf das reagieren, was im Spiel passiert.',
    ex: [
      {
        type: 'choice',
        kind: 'Reihenfolge',
        q: 'Was probierst du zuerst, wenn du auf ein Ereignis reagieren willst?',
        options: [
          'Die offizielle API und ihre Events',
          'Sofort ein Mixin',
          'Die Minecraft-Klasse kopieren und anpassen',
          'Einen Timer, der jede Sekunde nachschaut',
        ],
        answer: 0,
        why: 'Mixins sind das letzte Mittel. Was über die API geht, bleibt mit anderen Mods verträglich.',
      },
      {
        type: 'choice',
        kind: 'Mixin',
        q: 'Warum ist `@Inject` besser als `@Overwrite`?',
        options: [
          'Es hängt sich an eine Stelle an, statt die ganze Methode zu ersetzen',
          'Es ist schneller',
          'Es funktioniert auch ohne Mixin-Konfiguration',
          'Es braucht kein Gradle',
        ],
        answer: 0,
        why: '`@Overwrite` wirft den Original-Code weg. Zwei Mods, die dieselbe Methode überschreiben, vertragen sich nie.',
      },
      {
        type: 'gap',
        kind: 'Code',
        q: 'Ergänze den Mixin, der am Ende jedes Ticks läuft.',
        template: '@Inject(method = "tick", at = @At("___"))\nprivate void onTick(CallbackInfo ci) { }',
        tiles: ['TAIL', 'HEAD', 'RETURN', 'INVOKE'],
        answers: ['TAIL'],
        why: '`HEAD` läuft vor dem Original, `TAIL` danach. Für „nachdem alles passiert ist" ist `TAIL` richtig.',
      },
      {
        type: 'choice',
        kind: 'Seiten',
        q: 'Du gibst dem Spieler einen Effekt, aber er flackert und verschwindet. Was ist wahrscheinlich schuld?',
        options: [
          'Der Code läuft auch auf der Client-Seite',
          'Der Effekt ist zu kurz',
          'Das Mixin ist falsch registriert',
          'Die Registry ist voll',
        ],
        answer: 0,
        why: 'Spielzustand gehört auf den Server. Mit `if (world.isClient()) return;` bzw. `level.isClientSide()` steigst du auf dem Client früh aus.',
      },
    ],
  });

  const unitPluginSetup = () => ({
    id: 'pluginsetup',
    title: 'plugin.yml & onEnable',
    sub: 'Wie der Server dein Plugin findet und startet.',
    ex: [
      {
        type: 'choice',
        kind: 'Einstieg',
        q: 'Wovon erbt die Hauptklasse eines Paper-Plugins?',
        options: ['JavaPlugin', 'Plugin', 'Bukkit', 'Server'],
        answer: 0,
        why: '`public class MyPlugin extends JavaPlugin` — darüber bekommst du Logger, Config und den Plugin-Manager.',
      },
      {
        type: 'gap',
        kind: 'plugin.yml',
        q: 'Ergänze die Pflichtfelder.',
        template: 'name: HalloPlugin\nversion: 1.0.0\n___: dev.example.HalloPlugin\napi-version: "___"',
        tiles: ['main', 'class', '1.21', '21'],
        answers: ['main', '1.21'],
        why: '`main` zeigt auf die Klasse mit vollem Paketnamen. `api-version` ist die Minecraft-Version, nicht die Java-Version.',
      },
      {
        type: 'choice',
        kind: 'Lebenszyklus',
        q: 'Was gehört in `onEnable()`?',
        options: [
          'Listener registrieren, Befehle anmelden, Config laden',
          'Die Welt generieren',
          'Den Server starten',
          'Das Plugin bauen',
        ],
        answer: 0,
        why: '`onEnable()` läuft, wenn der Server dein Plugin hochfährt. Alles, was ab dann bereitstehen muss, wird hier verdrahtet.',
      },
      {
        type: 'choice',
        kind: 'Deployment',
        q: 'Wohin kommt deine fertige JAR?',
        options: [
          'In den Ordner plugins/ des Servers',
          'In den Ordner mods/',
          'In den .minecraft-Ordner',
          'In build/libs/, dort bleibt sie',
        ],
        answer: 0,
        why: 'Gradle legt sie in `build/libs/` ab — von dort kopierst du sie nach `plugins/` und startest den Server neu.',
      },
    ],
  });

  const unitListener = () => ({
    id: 'listener',
    title: 'Events & Listener',
    sub: 'Auf Spieler reagieren, ohne das Spiel zu verändern.',
    ex: [
      {
        type: 'choice',
        kind: 'Listener',
        q: 'Welche Schnittstelle muss deine Listener-Klasse implementieren?',
        options: ['Listener', 'EventHandler', 'Runnable', 'CommandExecutor'],
        answer: 0,
        why: '`implements Listener` markiert die Klasse. Die einzelnen Methoden bekommen dann `@EventHandler`.',
      },
      {
        type: 'gap',
        kind: 'Code',
        q: 'Ergänze den Listener für den Serverbeitritt.',
        template: '@___\npublic void onJoin(PlayerJoinEvent e) {\n    e.getPlayer().sendMessage("Willkommen!");\n}',
        tiles: ['EventHandler', 'Override', 'Inject', 'Listener'],
        answers: ['EventHandler'],
        why: 'Ohne `@EventHandler` wird die Methode nie aufgerufen — sie sieht dann nur aus wie ein Listener.',
      },
      {
        type: 'choice',
        kind: 'Anmeldung',
        q: 'Was fehlt, wenn dein Listener sauber aussieht, aber nie feuert?',
        options: [
          'Er ist nicht beim Plugin-Manager registriert',
          'Der Server ist zu alt',
          'Die JAR liegt falsch',
          'Das Event gibt es nicht',
        ],
        answer: 0,
        why: 'In `onEnable()`: `getServer().getPluginManager().registerEvents(new MyListener(), this);`',
      },
      {
        type: 'choice',
        kind: 'Abbrechen',
        q: 'Wie verhinderst du, dass ein Block abgebaut wird?',
        options: [
          'event.setCancelled(true) im BlockBreakEvent',
          'Den Block sofort wieder setzen',
          'Den Spieler kicken',
          'Gar nicht, das geht nur mit Mods',
        ],
        answer: 0,
        why: 'Viele Bukkit-Events sind abbrechbar. `setCancelled(true)` sagt dem Server: tu so, als wäre nichts passiert.',
      },
    ],
  });

  const unitCommand = () => ({
    id: 'command',
    title: 'Eigene Befehle',
    sub: 'Vom /hallo zum sinnvollen Werkzeug.',
    ex: [
      {
        type: 'choice',
        kind: 'Anmeldung',
        q: 'Wo muss ein klassischer Bukkit-Befehl deklariert werden?',
        options: [
          'In der plugin.yml unter commands:',
          'Nur im Code',
          'In der server.properties',
          'In der build.gradle',
        ],
        answer: 0,
        why: 'Erst der Eintrag in `plugin.yml`, dann `getCommand("hallo").setExecutor(...)` im Code.',
      },
      {
        type: 'choice',
        kind: 'Rückgabe',
        q: 'Was bedeutet `return false` in `onCommand`?',
        options: [
          'Der Server zeigt die usage-Zeile aus der plugin.yml',
          'Der Befehl ist fehlgeschlagen und wird geloggt',
          'Der Spieler wird gekickt',
          'Nichts, der Wert wird ignoriert',
        ],
        answer: 0,
        why: 'Deshalb gibt man bei falscher Argumentzahl `false` zurück und sonst `true`.',
      },
      {
        type: 'gap',
        kind: 'Code',
        q: 'Ergänze die Prüfung, ob der Befehl von einem Spieler kommt.',
        template: 'if (!(sender ___ Player player)) {\n    sender.sendMessage("Nur für Spieler.");\n    return true;\n}',
        tiles: ['instanceof', 'extends', 'implements', '=='],
        answers: ['instanceof'],
        why: 'Die Konsole ist auch ein `CommandSender`. Ohne diese Prüfung fliegt dein Plugin, sobald jemand den Befehl im Server-Terminal tippt.',
      },
      {
        type: 'choice',
        kind: 'Rechte',
        q: 'Wie beschränkst du einen Befehl auf Team-Mitglieder?',
        options: [
          'Über eine Permission, die du abfragst und in der plugin.yml deklarierst',
          'Über den Spielernamen im Code',
          'Über die Ops-Liste, anders geht es nicht',
          'Gar nicht',
        ],
        answer: 0,
        why: 'Permissions wie `meinplugin.hallo` lassen sich mit jedem Rechte-Plugin verteilen — Namen im Code sind unwartbar.',
      },
    ],
  });

  const unitRelease = (p) => ({
    id: 'release',
    title: 'Veröffentlichen',
    sub: 'Vom Ordner auf dem Rechner zu etwas, das andere benutzen.',
    ex: [
      {
        type: 'choice',
        kind: 'Recht',
        q: 'Darfst du deinen Mod verkaufen?',
        options: [
          'Nein — Mojangs EULA verbietet das. Spenden sind erlaubt.',
          'Ja, wenn du unter 50 € bleibst',
          'Ja, mit Mojang-Konto',
          'Nur auf CurseForge',
        ],
        answer: 0,
        why: 'Verkaufen ist raus. Ko-fi, Spenden oder Werbeeinnahmen über Modrinth sind üblich und erlaubt.',
      },
      {
        type: 'choice',
        kind: 'Versionen',
        q: 'Du hast eine Methode umbenannt, auf die andere Mods zugreifen. Welche Stelle der Version 1.4.2 ändert sich?',
        options: ['Die erste — 2.0.0', 'Die zweite — 1.5.0', 'Die dritte — 1.4.3', 'Keine'],
        answer: 0,
        why: 'Semantic Versioning: was bestehenden Code bricht, erhöht die erste Zahl. Neue Features die zweite, Bugfixes die dritte.',
      },
      {
        type: 'order',
        kind: 'Ablauf',
        q: 'Bring die Veröffentlichung in die richtige Reihenfolge.',
        lines: [
          'Version in gradle.properties hochzählen',
          'Changelog schreiben',
          'Bauen und die JAR im Spiel testen',
          'Git-Tag setzen und pushen',
          'Auf Modrinth hochladen',
        ],
        why: 'Testen vor dem Tag. Ein Tag auf einer kaputten Version ist eine Lüge, die im Repo stehen bleibt.',
      },
    ],
  });

  const buildCurriculum = () => {
    const p = platformOf();
    const units = [unitJava()];
    if (S.answers.target === 'plugin') {
      units.push(unitSetup('paper'), unitPluginSetup(), unitListener(), unitCommand(), unitRelease('paper'));
    } else {
      units.push(unitSetup(p), unitItem(p), unitBlock(), unitEvents(p), unitRelease(p));
    }
    return units;
  };

  /* Aufgaben für die IDE, wenn „Rätsel plus echtes Projekt" gewählt wurde. */
  const editorTasks = () => {
    const p = platformOf();
    if (S.answers.target === 'plugin') {
      return [
        { t: 'Projekt anlegen und bauen', d: 'Gradle-Projekt mit Paper-API, dann build ausführen.', c: './gradlew build' },
        { t: 'plugin.yml ausfüllen', d: 'name, version, main und api-version eintragen.' },
        { t: 'JAR auf den Server', d: 'Aus build/libs/ nach plugins/ kopieren und neu starten.' },
        { t: 'Begrüßung beim Join', d: 'Listener mit PlayerJoinEvent, im onEnable registrieren.' },
        { t: 'Befehl /hallo', d: 'In plugin.yml deklarieren, Executor setzen, auf Spieler prüfen.' },
      ];
    }
    return [
      { t: 'Template zum Laufen bringen', d: 'Projekt öffnen, Gradle importieren, Dev-Client starten.', c: p === 'fabric' ? './gradlew runClient' : './gradlew runClient' },
      { t: 'Mod-ID auf deinen Namen ändern', d: 'In gradle.properties und ' + (p === 'fabric' ? 'fabric.mod.json' : L[p].meta) + '.' },
      { t: 'Ein Item registrieren', d: 'Klasse ModItems anlegen und vom Einstiegspunkt aus aufrufen.' },
      { t: 'Textur und Name geben', d: '16×16-PNG anlegen, Modell-JSON schreiben, Sprachdatei ergänzen.' },
      { t: 'Einen Block mit BlockItem', d: 'Block registrieren, BlockItem dazu, Loot-Table nicht vergessen.' },
      { t: 'Auf ein Event reagieren', d: 'Über die API, nicht über ein Mixin — das kommt danach.' },
    ];
  };

  /* ══════════════════════════════════════════════════════════════════
     Router
     ══════════════════════════════════════════════════════════════════ */
  const screens = {};
  $$('.screen').forEach((s) => { screens[s.dataset.screen] = s; });

  const show = (name) => {
    Object.entries(screens).forEach(([k, node]) => { node.hidden = k !== name; });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
  };

  /* ══════════════════════════════════════════════════════════════════
     Onboarding-Ablauf
     ══════════════════════════════════════════════════════════════════ */
  let qIndex = 0;

  const renderSteps = () => {
    const box = $('#steps');
    box.innerHTML = '';
    QUESTIONS.forEach((_, i) => {
      const i2 = el('i');
      if (i < qIndex) i2.className = 'done';
      else if (i === qIndex) i2.className = 'now';
      box.appendChild(i2);
    });
  };

  const renderQuestion = () => {
    const q = QUESTIONS[qIndex];
    renderSteps();
    setKobo($('#quiz-kobo'), qIndex === 0 ? 'idle' : 'think', 'kobo-bounce');
    $('#quiz-bubble').textContent = q.bubble;
    $('#quiz-question').textContent = q.q;
    $('#quiz-sub').textContent = q.sub || '';
    $('#quiz-back').hidden = qIndex === 0;

    const box = $('#quiz-options');
    box.innerHTML = '';
    q.options.forEach((o) => {
      const b = el('button', 'opt');
      b.type = 'button';
      if (S.answers[q.id] === o.v) b.classList.add('sel');
      const ico = el('span', 'opt-ico', o.ico);
      const txt = el('span', 'opt-txt');
      txt.appendChild(el('b', null, o.t));
      txt.appendChild(el('span', null, o.d));
      b.appendChild(ico);
      b.appendChild(txt);
      b.addEventListener('click', () => {
        S.answers[q.id] = o.v;
        save();
        $$('.opt', box).forEach((n) => n.classList.remove('sel'));
        b.classList.add('sel');
        setTimeout(nextQuestion, 220);
      });
      box.appendChild(b);
    });
    show('quiz');
  };

  const nextQuestion = () => {
    if (qIndex < QUESTIONS.length - 1) {
      qIndex++;
      renderQuestion();
      return;
    }
    S.onboarded = true;
    save();
    if (S.answers.installed === 'yes') goMap();
    else renderSetup();
  };

  $('#quiz-back').addEventListener('click', () => {
    if (qIndex > 0) { qIndex--; renderQuestion(); }
  });

  /* ══════════════════════════════════════════════════════════════════
     Setup-Bildschirm
     ══════════════════════════════════════════════════════════════════ */
  let activeTool = null;

  const renderSetupDetail = () => {
    const box = $('#setup-detail');
    box.innerHTML = '';
    if (!activeTool) {
      box.appendChild(el('p', 'empty', 'Tipp auf einen Eintrag links — dann zeige ich dir, wo du ihn herbekommst und worauf du achten musst.'));
      return;
    }
    const t = TOOLS[activeTool];
    box.appendChild(el('h3', null, t.name));
    box.appendChild(el('p', 'why', t.why));

    const a = el('a', 'dl-link');
    a.href = t.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '↗ ' + t.urlText;
    box.appendChild(a);

    const ol = el('ol');
    t.steps.forEach((s) => {
      const li = document.createElement('li');
      li.innerHTML = s;
      ol.appendChild(li);
    });
    box.appendChild(ol);

    if (t.cmd) {
      const c = el('div', 'cmd');
      c.appendChild(el('span', null, t.cmd));
      const cp = el('button', null, 'Kopieren');
      cp.type = 'button';
      cp.addEventListener('click', () => {
        navigator.clipboard?.writeText(t.cmd)
          .then(() => { cp.textContent = 'Kopiert'; setTimeout(() => { cp.textContent = 'Kopieren'; }, 1600); })
          .catch(() => { cp.textContent = 'Ging nicht'; });
      });
      c.appendChild(cp);
      box.appendChild(c);
    }
  };

  const renderSetup = () => {
    const need = requiredTools();
    const list = $('#setup-list');
    list.innerHTML = '';

    allTools().forEach((id) => {
      const t = TOOLS[id];
      const li = document.createElement('li');
      const b = el('button', 'setup-item');
      b.type = 'button';
      if (S.setup.includes(id)) b.classList.add('checked');
      if (activeTool === id) b.classList.add('active');

      const box = el('span', 'box');
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = S.setup.indexOf(id);
        if (i >= 0) S.setup.splice(i, 1); else S.setup.push(id);
        save();
        renderSetup();
      });

      const who = el('span', 'who');
      who.appendChild(el('b', null, t.name));
      who.appendChild(el('span', null, t.short));

      b.appendChild(box);
      b.appendChild(who);
      if (!need.includes(id)) b.appendChild(el('span', 'opt-tag', 'optional'));

      b.addEventListener('click', () => {
        activeTool = id;
        renderSetup();
        renderSetupDetail();
      });
      li.appendChild(b);
      list.appendChild(li);
    });

    const have = need.filter((id) => S.setup.includes(id)).length;
    $('#setup-count').textContent = have + ' von ' + need.length + ' Pflicht-Werkzeugen abgehakt';
    $('#setup-done').disabled = have < need.length;

    const name = PLATFORM_NAME[platformOf()];
    setKobo($('#setup-kobo'), have === need.length ? 'happy' : 'idle');
    $('#setup-bubble').textContent = have === need.length
      ? 'Werkbank steht. Von hier an wird gebaut.'
      : 'Kein Stress — das ist einmalige Arbeit. Tipp jeden Eintrag an, ich sage dir, wo er herkommt.';
    $('#setup-lede').textContent = S.answers.target === 'plugin'
      ? 'Für Plugins brauchst du keinen Mod-Loader, sondern einen Server. Ich habe deine Liste auf ' + name + ' umgestellt.'
      : 'Zusammengestellt für ' + name + '. Was du schon hast, hakst du links im Kästchen ab.';

    renderSetupDetail();
    show('setup');
  };

  // goMap wird weiter unten definiert — im Callback aufrufen, nicht als Wert übergeben.
  $('#setup-done').addEventListener('click', () => goMap());
  $('#setup-skip').addEventListener('click', () => {
    S.setupSkipped = true;
    S.answers.mode = 'browser';
    save();
    goMap();
  });

  /* ══════════════════════════════════════════════════════════════════
     Lernpfad
     ══════════════════════════════════════════════════════════════════ */
  let units = [];

  const unlockedCount = () => {
    if (S.answers.level === 'shipped') return units.length;
    let n = 1;
    units.forEach((u, i) => { if (S.done[u.id]) n = Math.max(n, i + 2); });
    return Math.min(n, units.length);
  };

  const goMap = () => {
    units = buildCurriculum();
    const doneCount = units.filter((u) => S.done[u.id]).length;

    $('#stat-xp').textContent = S.xp;
    $('#stat-done').textContent = doneCount + '/' + units.length;
    $('#stat-streak').textContent = S.streak;

    setKobo($('#map-kobo'), doneCount ? 'happy' : 'idle');
    $('#map-bubble').textContent = doneCount === units.length && doneCount > 0
      ? 'Alles durch. Ehrlich? Jetzt fängt der spannende Teil an — bau was Eigenes.'
      : doneCount === 0
        ? 'Dein Pfad steht. Fang oben an, jede Lektion dauert ein paar Minuten.'
        : 'Weiter so. Noch ' + (units.length - doneCount) + ' Lektionen bis zum Ende.';

    const chips = $('#profile-chips');
    chips.innerHTML = '';
    const levelName = {
      none: 'Anfänger', basics: 'Java-Grundlagen', tried: 'Schon gemoddet', shipped: 'Veröffentlicht',
    }[S.answers.level] || '—';
    const add = (label, value) => {
      const s = el('span');
      s.appendChild(document.createTextNode(label + ' '));
      s.appendChild(el('b', null, value));
      chips.appendChild(s);
    };
    add('Stand:', levelName);
    add('Plattform:', PLATFORM_NAME[platformOf()]);
    add('Ziel:', S.answers.target === 'plugin' ? 'Plugins' : 'Mods');
    add('Modus:', S.answers.mode === 'both' ? 'Browser + IDE' : 'Nur Browser');

    if (S.answers.target === 'plugin' && S.answers.loader && S.answers.loader !== 'unsure') {
      const note = el('span');
      note.appendChild(document.createTextNode('Hinweis: Plugins brauchen keinen Loader — '));
      note.appendChild(el('b', null, PLATFORM_NAME[S.answers.loader] + ' ersetzt durch Paper'));
      chips.appendChild(note);
    }

    const open = unlockedCount();
    const path = $('#path');
    path.innerHTML = '';
    units.forEach((u, i) => {
      const li = el('li', 'node');
      const done = !!S.done[u.id];
      const locked = i >= open;
      if (done) li.classList.add('done');
      else if (!locked) li.classList.add('open');
      if (locked) li.classList.add('locked');

      const b = el('button', 'node-btn');
      b.type = 'button';
      b.disabled = locked;
      const txt = el('span', 'node-txt');
      txt.appendChild(el('b', null, u.title));
      txt.appendChild(el('span', null, locked ? 'Erst die Lektion davor abschließen' : u.sub));
      const meta = el('span', 'node-meta');
      meta.appendChild(el('span', null, u.ex.length + ' Übungen'));
      if (done) meta.appendChild(el('span', 'xp', '✓ fertig'));
      b.appendChild(txt);
      b.appendChild(meta);
      b.addEventListener('click', () => { if (!locked) startLesson(u); });
      li.appendChild(b);
      path.appendChild(li);
    });

    const wrap = $('#editor-tasks');
    if (S.answers.mode === 'both') {
      wrap.hidden = false;
      const ul = $('#task-list');
      ul.innerHTML = '';
      editorTasks().forEach((t, i) => {
        const li = document.createElement('li');
        const b = el('button', 'task');
        b.type = 'button';
        if (S.tasks.includes(i)) b.classList.add('checked');
        b.appendChild(el('span', 'box'));
        const who = el('span', 'who');
        who.appendChild(el('b', null, t.t));
        const d = el('span');
        d.textContent = t.d;
        if (t.c) {
          d.appendChild(document.createTextNode(' '));
          d.appendChild(el('code', null, t.c));
        }
        who.appendChild(d);
        b.appendChild(who);
        b.addEventListener('click', () => {
          const k = S.tasks.indexOf(i);
          if (k >= 0) S.tasks.splice(k, 1); else S.tasks.push(i);
          save();
          goMap();
        });
        li.appendChild(b);
        ul.appendChild(li);
      });
    } else {
      wrap.hidden = true;
    }

    show('map');
  };

  /* ══════════════════════════════════════════════════════════════════
     Übungs-Engine
     ══════════════════════════════════════════════════════════════════ */
  const lesson = {
    unit: null, list: [], i: 0, hearts: 3, right: 0, xp: 0,
    answered: false, correct: false, get: null,
  };

  const setHearts = () => {
    const box = $('#hearts');
    box.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const h = el('i', i < lesson.hearts ? '' : 'gone', '♥');
      box.appendChild(h);
    }
  };

  const startLesson = (unit) => {
    lesson.unit = unit;
    lesson.list = unit.ex;
    lesson.i = 0;
    lesson.hearts = 3;
    lesson.right = 0;
    lesson.xp = 0;
    setHearts();
    show('lesson');
    renderExercise();
  };

  const setFoot = (state) => {
    const foot = $('#lesson-foot');
    foot.classList.remove('ok', 'no');
    if (state) foot.classList.add(state);
  };

  const renderExercise = () => {
    const ex = lesson.list[lesson.i];
    lesson.answered = false;
    lesson.correct = false;
    lesson.get = null;

    $('#lesson-fill').style.width = ((lesson.i) / lesson.list.length * 100) + '%';
    $('#ex-kind').textContent = ex.kind || 'Übung';
    $('#ex-q').textContent = ex.q;
    $('#feedback').hidden = true;
    setFoot(null);

    const check = $('#check-btn');
    check.textContent = 'Prüfen';
    check.disabled = true;

    const area = $('#ex-area');
    area.innerHTML = '';

    if (ex.type === 'choice') renderChoice(ex, area, check);
    else if (ex.type === 'gap') renderGap(ex, area, check);
    else if (ex.type === 'order') renderOrder(ex, area, check);
    else renderInput(ex, area, check);
  };

  /* Auswahl ---------------------------------------------------------- */
  function renderChoice(ex, area, check) {
    const box = el('div', 'choices');
    const order = shuffle(ex.options.map((t, i) => ({ t, i })));
    let picked = null;
    order.forEach((o, n) => {
      const b = el('button', 'choice');
      b.type = 'button';
      b.appendChild(el('span', 'key', String(n + 1)));
      b.appendChild(el('span', null, o.t));
      b.addEventListener('click', () => {
        if (lesson.answered) return;
        picked = o.i;
        $$('.choice', box).forEach((n2) => n2.classList.remove('sel'));
        b.classList.add('sel');
        check.disabled = false;
      });
      b._idx = o.i;
      box.appendChild(b);
    });
    area.appendChild(box);
    lesson.get = () => {
      const ok = picked === ex.answer;
      $$('.choice', box).forEach((b) => {
        b.disabled = true;
        if (b._idx === ex.answer) b.classList.add('right');
        else if (b._idx === picked) b.classList.add('wrong');
      });
      return ok;
    };
  }

  /* Lücken ----------------------------------------------------------- */
  function renderGap(ex, area, check) {
    const code = el('div', 'gap-code');
    const parts = ex.template.split('___');
    const slots = [];
    parts.forEach((p, i) => {
      code.appendChild(document.createTextNode(p));
      if (i < parts.length - 1) {
        const s = el('button', 'slot');
        s.type = 'button';
        s.dataset.i = i;
        s.textContent = '';
        s.addEventListener('click', () => {
          if (lesson.answered || !s.dataset.val) return;
          const tile = tiles.find((t) => t.textContent === s.dataset.val && t.classList.contains('used'));
          if (tile) tile.classList.remove('used');
          s.dataset.val = '';
          s.textContent = '';
          s.classList.remove('filled');
          check.disabled = slots.some((x) => !x.dataset.val);
        });
        slots.push(s);
        code.appendChild(s);
      }
    });
    area.appendChild(code);

    const bank = el('div', 'tiles');
    const tiles = [];
    shuffle(ex.tiles).forEach((t) => {
      const b = el('button', 'tile', t);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (lesson.answered) return;
        const free = slots.find((s) => !s.dataset.val);
        if (!free) return;
        free.dataset.val = t;
        free.textContent = t;
        free.classList.add('filled');
        b.classList.add('used');
        check.disabled = slots.some((s) => !s.dataset.val);
      });
      tiles.push(b);
      bank.appendChild(b);
    });
    area.appendChild(bank);

    lesson.get = () => {
      let ok = true;
      slots.forEach((s, i) => {
        const good = s.dataset.val === ex.answers[i];
        s.classList.add(good ? 'right' : 'wrong');
        if (!good) { ok = false; s.textContent = ex.answers[i]; }
      });
      tiles.forEach((t) => { t.disabled = true; });
      return ok;
    };
  }

  /* Reihenfolge ------------------------------------------------------ */
  function renderOrder(ex, area, check) {
    const target = el('div', 'order-target');
    const pool = el('div', 'order-pool');
    const chosen = [];

    const refresh = () => {
      check.disabled = chosen.length !== ex.lines.length;
    };

    shuffle(ex.lines.map((t, i) => ({ t, i }))).forEach((o) => {
      const b = el('button', 'line');
      b.type = 'button';
      b.appendChild(el('span', 'num', '+'));
      b.appendChild(el('span', null, o.t));
      b._idx = o.i;
      b.addEventListener('click', () => {
        if (lesson.answered) return;
        b.remove();
        chosen.push(o.i);
        const c = el('button', 'line');
        c.type = 'button';
        c.appendChild(el('span', 'num', String(chosen.length)));
        c.appendChild(el('span', null, o.t));
        c._idx = o.i;
        c.addEventListener('click', () => {
          if (lesson.answered) return;
          const at = chosen.indexOf(o.i);
          if (at >= 0) chosen.splice(at, 1);
          c.remove();
          $$('.line', target).forEach((n, k) => { n.firstChild.textContent = String(k + 1); });
          pool.appendChild(b);
          refresh();
        });
        target.appendChild(c);
        refresh();
      });
      pool.appendChild(b);
    });

    area.appendChild(target);
    area.appendChild(pool);

    lesson.get = () => {
      let ok = true;
      $$('.line', target).forEach((n, k) => {
        const good = n._idx === k;
        n.classList.add(good ? 'right' : 'wrong');
        if (!good) ok = false;
      });
      $$('.line', area).forEach((n) => { n.disabled = true; });
      return ok;
    };
  }

  /* Freie Eingabe ---------------------------------------------------- */
  function renderInput(ex, area, check) {
    const inp = el('input', 'text-in');
    inp.type = 'text';
    inp.autocapitalize = 'off';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.placeholder = 'Antwort eintippen';
    inp.addEventListener('input', () => { check.disabled = !inp.value.trim(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !check.disabled) check.click();
    });
    area.appendChild(inp);
    if (ex.hint) area.appendChild(el('p', 'in-hint', ex.hint));

    lesson.get = () => {
      const v = inp.value.trim().toLowerCase().replace(/\s+/g, '');
      const ok = ex.answers.some((a) => a.toLowerCase().replace(/\s+/g, '') === v);
      inp.classList.add(ok ? 'right' : 'wrong');
      inp.disabled = true;
      return ok;
    };
  }

  /* Prüfen und weiter ------------------------------------------------ */
  $('#check-btn').addEventListener('click', () => {
    const check = $('#check-btn');
    const ex = lesson.list[lesson.i];

    if (!lesson.answered) {
      lesson.answered = true;
      lesson.correct = lesson.get();
      const fb = $('#feedback');
      fb.hidden = false;
      fb.classList.toggle('ok', lesson.correct);
      fb.classList.toggle('no', !lesson.correct);
      setFoot(lesson.correct ? 'ok' : 'no');
      setKobo($('#fb-kobo'), lesson.correct ? 'happy' : 'sad', lesson.correct ? 'kobo-bounce' : 'kobo-shake');

      const praise = ['Sitzt.', 'Genau so.', 'Richtig.', 'Sauber.'];
      $('#fb-title').textContent = lesson.correct
        ? praise[Math.floor(Math.random() * praise.length)]
        : 'Nicht ganz.';
      $('#fb-text').innerHTML = (ex.why || '').replace(/`([^`]+)`/g, '<code>$1</code>');

      if (lesson.correct) { lesson.right++; lesson.xp += 10; }
      else { lesson.hearts--; setHearts(); }

      check.textContent = lesson.i === lesson.list.length - 1 ? 'Abschließen' : 'Weiter';
      if (lesson.hearts <= 0) check.textContent = 'Ergebnis ansehen';
      return;
    }

    if (lesson.hearts <= 0) { finishLesson(false); return; }
    if (lesson.i === lesson.list.length - 1) { finishLesson(true); return; }
    lesson.i++;
    renderExercise();
  });

  $('#lesson-quit').addEventListener('click', () => goMap());

  const bumpStreak = () => {
    const d = today();
    if (S.lastDay === d) return;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    S.streak = S.lastDay === y ? S.streak + 1 : 1;
    S.lastDay = d;
  };

  const finishLesson = (passed) => {
    $('#lesson-fill').style.width = '100%';
    const total = lesson.list.length;
    const acc = Math.round((lesson.right / total) * 100);

    // Bonus fürs erste Bestehen — vor dem Setzen von done ermitteln.
    const first = passed && !S.done[lesson.unit.id];
    const earned = passed ? lesson.xp + (first ? 20 : 0) : 0;
    if (passed) {
      S.done[lesson.unit.id] = true;
      S.xp += earned;
      bumpStreak();
      save();
    }

    setKobo($('#result-kobo'), passed ? 'happy' : 'sad');
    $('#result-kobo').classList.toggle('kobo-cheer', passed);
    $('#result-title').textContent = passed ? 'Lektion geschafft!' : 'Herzen alle.';
    $('#result-text').textContent = passed
      ? (acc === 100
        ? 'Fehlerfrei durch — das schafft nicht jeder beim ersten Versuch.'
        : 'Fertig. Die Stellen, an denen es geklemmt hat, kommen später nochmal.')
      : 'Passiert. Nochmal von vorn, diesmal weißt du schon, wo die Fallen liegen.';
    $('#result-xp').textContent = earned;
    $('#result-acc').textContent = acc + '%';
    $('#result-next').textContent = 'Zurück zum Pfad';
    show('result');
  };

  $('#result-next').addEventListener('click', () => goMap());
  $('#result-again').addEventListener('click', () => startLesson(lesson.unit));

  /* ══════════════════════════════════════════════════════════════════
     Rahmen: Start, Reset, Navigation
     ══════════════════════════════════════════════════════════════════ */
  $('#start-btn').addEventListener('click', () => { qIndex = 0; renderQuestion(); });
  $('#resume-btn').addEventListener('click', () => goMap());

  $('#reset-btn').addEventListener('click', () => {
    if (!window.confirm('Fortschritt und Antworten löschen und neu anfangen?')) return;
    S = blank();
    save();
    activeTool = null;
    qIndex = 0;
    setKobo($('#intro-kobo'), 'idle');
    $('#resume-note').hidden = true;
    show('intro');
  });

  const burger = $('#burger');
  const menu = $('.nav-links');
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });

  /* Fortschrittsbalken oben, wie auf der Startseite. */
  const bar = $('#progress-bar');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? Math.min(1, window.scrollY / max) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Start ------------------------------------------------------------ */
  load();
  setKobo($('#intro-kobo'), 'idle');
  setKobo($('#setup-kobo'), 'idle');
  setKobo($('#map-kobo'), 'idle');
  setKobo($('#fb-kobo'), 'idle');
  setKobo($('#result-kobo'), 'happy');

  if (S.onboarded) {
    $('#resume-note').hidden = false;
    goMap();
  } else {
    show('intro');
  }
})();
