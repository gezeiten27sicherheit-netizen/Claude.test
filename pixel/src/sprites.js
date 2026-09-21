// Handgezeichnete Pixel-Art. Jede Grafik ist ein Raster aus Zeichen, das ueber
// eine Palette in ein Offscreen-Canvas gemalt wird (1 Zeichen = 1 Pixel).
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;

  function paint(rows, palette) {
    const h = rows.length;
    const w = rows[0].length;
    const c = U.canvas(w, h);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const col = palette[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  // Waagerecht gespiegelte Kopie (fuer Blickrichtung links).
  function flip(src) {
    const c = U.canvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  // Eingefaerbte Kopie (Trefferblitz).
  function tint(src, color, alpha) {
    const c = U.canvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Sprite-Paar: nach rechts und nach links blickend.
  function pair(rows, palette) {
    const right = paint(rows, palette);
    return { right, left: flip(right), white: null, w: right.width, h: right.height };
  }

  // ---------------------------------------------------------------- Held ----
  const HERO_PAL = {
    o: '#1b1524', g: '#47a05e', G: '#2f7043', s: '#f7cd9b', S: '#d79a68',
    b: '#efe3c4', B: '#d8ae2f', p: '#7a4b2a', k: '#3c2a1b',
  };

  // Oberkoerper (Zeilen 0-12), Beine werden je Animationsphase angehaengt.
  const HERO_BODY = [
    '............',
    '...ooooooo..',
    '..ogggggggo.',
    '..ogggggggo.',
    '..ogsssssgo.',
    '..ogsososgo.',
    '..ogssSssgo.',
    '...oSSSSSo..',
    '..obbbbbbbo.',
    '.sobbbBbbbos',
    '.sobbbbbbbos',
    '..obbbbbbbo.',
    '..oBBBBBBBo.',
  ];

  const LEGS = {
    idle: ['..opppppppo.', '..opp..ppo..', '..okk..kko..'],
    run1: ['..opppppppo.', '.opp...ppo..', '.okk....kko.'],
    run2: ['..opppppppo.', '..opppppo...', '..okk.kko...'],
    run3: ['..opppppppo.', '..opp...ppo.', '.okk....kko.'],
    run4: ['..opppppppo.', '...opppppo..', '...okk.kko..'],
    jump: ['..opppppppo.', '.opp....ppo.', '.okk....kko.'],
    fall: ['..opppppppo.', '..opp..ppo..', '.okk.....kko'],
  };

  function heroFrame(legKey) {
    return HERO_BODY.concat(LEGS[legKey]);
  }

  // --------------------------------------------------------------- Gegner ---
  const SLIME_PAL = {
    o: '#1b1524', m: '#5ad17f', h: '#a7f0bd', d: '#2f8a53', e: '#1b1524', W: '#ffffff',
  };
  const SLIME_A = [
    '............',
    '....oooo....',
    '..ohhhhhho..',
    '.ohhmmmmmmo.',
    '.ohmmmmmmmo.',
    'ohmWemmWemmo',
    'ohmmmmmmmmdo',
    'ohmmmmmmmmdo',
    'oddmmmmmmddo',
    '.oooooooooo.',
  ];
  const SLIME_B = [
    '............',
    '............',
    '...oooooo...',
    '.ohhhhhhhho.',
    'ohhmmmmmmmmo',
    'ohmWemmWemmo',
    'ohmmmmmmmmdo',
    'oddmmmmmmddo',
    '.oooooooooo.',
    '............',
  ];

  const BAT_PAL = { o: '#150f22', v: '#8a5cc4', V: '#5b3a86', W: '#6d47a3', e: '#ff5566' };
  const BAT_A = [
    '..o........o..',
    '.oWo......oWo.',
    '.oWWo.oo.oWWo.',
    '..oWWovvoWWo..',
    '...oWoeeoWo...',
    '....oovvoo....',
    '......oVo.....',
    '.......o......',
  ];
  const BAT_B = [
    '......oo......',
    '.....ovvo.....',
    '.....oeeo.....',
    '..oooovvoooo..',
    '.oWWWoVVoWWWo.',
    'oWWWo..o..oWWo',
    'oWo........oWo',
    '..............',
  ];

  // --------------------------------------------------------------- Beute ----
  const COIN_PAL = { o: '#7a5a10', y: '#ffd94a', Y: '#fff3ae', d: '#c99a1e' };
  const COIN_0 = ['..oooo..', '.oYYyyo.', 'oYyyyydo', 'oYyyyydo', 'oyyyyddo', 'oyyydddo', '.oddddo.', '..oooo..'];
  const COIN_1 = ['...oo...', '..oYyo..', '..oYydo.', '..oYydo.', '..oyydo.', '..oyddo.', '..oddo..', '...oo...'];
  const COIN_2 = ['...o....', '...oo...', '...Yo...', '...Yo...', '...yo...', '...yo...', '...do...', '...o....'];

  const HEART_PAL = { o: '#3a1020', r: '#ff4d6d', R: '#ffa3b5' };
  const HEART = ['.oo..oo.', 'oRRooRRo', 'orrrrrro', 'orrrrrro', '.orrrro.', '..orro..', '...oo...', '........'];

  const GEM_PAL = { o: '#12203a', c: '#5fd8ff', C: '#d5f8ff', D: '#2a86c9' };
  const GEM = ['..oooo..', '.oCCcco.', 'oCccccDo', 'oCccccDo', '.occcDo.', '..occDo.', '...oDo..', '....o...'];

  // --------------------------------------------------------- Schwert/Hieb ---
  const SWORD_PAL = { o: '#1b1524', H: '#8b5a2b', G: '#e0b93c', w: '#eef6ff', v: '#9ab6d4' };
  const SWORD = ['...........', '....oooooo.', 'oHHGwwwwwwo', 'oHHGvvvvvvo', '....oooooo.'];

  const SLASH_PAL = { w: '#ffffff', a: '#cfe9ff', c: '#7fa8dd' };
  const SLASH_A = [
    '................',
    '................',
    '..........ww....',
    '........wwaa....',
    '.......waaa.....',
    '......waa.......',
    '.....waa........',
    '.....wa.........',
    '.....wa.........',
    '.....waa........',
    '......waa.......',
    '.......waaa.....',
    '........wwaa....',
    '..........ww....',
    '................',
    '................',
  ];
  const SLASH_B = [
    '................',
    '.........aa.....',
    '.......aacc.....',
    '......acc.......',
    '.....ac.........',
    '....ac..........',
    '....ac..........',
    '....ac..........',
    '.....ac.........',
    '......acc.......',
    '.......aacc.....',
    '.........aa.....',
    '................',
    '................',
    '................',
    '................',
  ];

  let cache = null;

  function build() {
    if (cache) return cache;
    const hero = {};
    ['idle', 'run1', 'run2', 'run3', 'run4', 'jump', 'fall'].forEach((k) => {
      hero[k] = pair(heroFrame(k), HERO_PAL);
    });
    hero.hurt = { right: tint(hero.idle.right, '#ffffff', 0.9), left: tint(hero.idle.left, '#ffffff', 0.9) };

    cache = {
      hero,
      sword: pair(SWORD, SWORD_PAL),
      slash: [pair(SLASH_A, SLASH_PAL), pair(SLASH_B, SLASH_PAL)],
      slime: [pair(SLIME_A, SLIME_PAL), pair(SLIME_B, SLIME_PAL)],
      bat: [pair(BAT_A, BAT_PAL), pair(BAT_B, BAT_PAL)],
      coin: [paint(COIN_0, COIN_PAL), paint(COIN_1, COIN_PAL), paint(COIN_2, COIN_PAL), flip(paint(COIN_1, COIN_PAL))],
      heart: paint(HEART, HEART_PAL),
      gem: paint(GEM, GEM_PAL),
    };
    cache.slimeWhite = [tint(cache.slime[0].right, '#ffffff'), tint(cache.slime[1].right, '#ffffff')];
    cache.batWhite = [tint(cache.bat[0].right, '#ffffff'), tint(cache.bat[1].right, '#ffffff')];
    return cache;
  }

  PX.sprites = { build, paint, flip, tint, pair };
})();
