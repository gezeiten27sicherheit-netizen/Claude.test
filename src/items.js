// Block + item + fuse-recipe definitions shared across the game.
(function () {
  const BLOCK = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
    WOOD: 6, LEAVES: 7, PLANK: 8, ORE_IRON: 9, ORE_GOLD: 10,
    ORE_CRYSTAL: 11, SHRINE_STONE: 12, SHRINE_GLOW: 13, TORCH: 14, SNOW: 15,
  };

  // color: base vertex color (hex), light: emissive point-light strength (0 = none)
  const BLOCK_DATA = {
    [BLOCK.GRASS]:        { name: 'Gras',            color: 0x5b9c3a, solid: true, breakTime: 0.4, drop: 'dirt' },
    [BLOCK.DIRT]:         { name: 'Erde',             color: 0x7a5230, solid: true, breakTime: 0.4, drop: 'dirt' },
    [BLOCK.STONE]:        { name: 'Stein',            color: 0x8a8a8e, solid: true, breakTime: 1.1, drop: 'stone', needsPick: true },
    [BLOCK.SAND]:         { name: 'Sand',             color: 0xe0d18f, solid: true, breakTime: 0.4, drop: 'sand' },
    [BLOCK.WATER]:        { name: 'Wasser',           color: 0x3b6fd6, solid: false, breakTime: 0, drop: null, transparent: true },
    [BLOCK.WOOD]:         { name: 'Baumstamm',        color: 0x6b4a2b, solid: true, breakTime: 0.7, drop: 'wood' },
    [BLOCK.LEAVES]:       { name: 'Laub',             color: 0x3f7d2c, solid: true, breakTime: 0.25, drop: 'leaves', transparent: true },
    [BLOCK.PLANK]:        { name: 'Bretter',          color: 0xb08552, solid: true, breakTime: 0.6, drop: 'plank' },
    [BLOCK.ORE_IRON]:     { name: 'Eisenerz',         color: 0xc9a27a, solid: true, breakTime: 1.6, drop: 'iron_chunk', needsPick: true },
    [BLOCK.ORE_GOLD]:     { name: 'Golderz',          color: 0xe8c34a, solid: true, breakTime: 1.8, drop: 'gold_chunk', needsPick: true },
    [BLOCK.ORE_CRYSTAL]:  { name: 'Zonai-Kristall',   color: 0x6fe8e0, solid: true, breakTime: 2.2, drop: 'crystal', needsPick: true, light: 0.6 },
    [BLOCK.SHRINE_STONE]: { name: 'Schreinstein',     color: 0x3a3d52, solid: true, breakTime: 3.0, drop: null, needsPick: true },
    [BLOCK.SHRINE_GLOW]:  { name: 'Sheikah-Kern',     color: 0x49e0ff, solid: true, breakTime: 999, drop: null, light: 1.4 },
    [BLOCK.TORCH]:        { name: 'Fackel',           color: 0xffb347, solid: true, breakTime: 0.2, drop: 'torch', light: 1.0, transparent: true },
    [BLOCK.SNOW]:         { name: 'Schnee',           color: 0xf2f6ff, solid: true, breakTime: 0.3, drop: 'dirt' },
  };

  // Items: things that live in the inventory. type: block | material | tool | weapon | food | special
  const ITEMS = {
    dirt:        { name: 'Erde',            type: 'block', block: BLOCK.DIRT, icon: '🟫', max: 64 },
    stone:       { name: 'Stein',           type: 'block', block: BLOCK.STONE, icon: '⬜', max: 64 },
    sand:        { name: 'Sand',            type: 'block', block: BLOCK.SAND, icon: '🟨', max: 64 },
    wood:        { name: 'Baumstamm',       type: 'block', block: BLOCK.WOOD, icon: '🪵', max: 64 },
    leaves:      { name: 'Laub',            type: 'block', block: BLOCK.LEAVES, icon: '🍃', max: 64 },
    plank:       { name: 'Bretter',         type: 'block', block: BLOCK.PLANK, icon: '🟧', max: 64 },
    torch:       { name: 'Fackel',          type: 'block', block: BLOCK.TORCH, icon: '🔥', max: 64 },
    stick:       { name: 'Stock',           type: 'material', icon: '🥢', max: 64, power: 1 },
    iron_chunk:  { name: 'Eisenbrocken',    type: 'material', icon: '🔩', max: 64, power: 4 },
    gold_chunk:  { name: 'Goldbrocken',     type: 'material', icon: '🟡', max: 64, power: 5 },
    crystal:     { name: 'Zonai-Kristall',  type: 'material', icon: '💎', max: 64, power: 8 },
    meat:        { name: 'Rohes Fleisch',   type: 'food', icon: '🥩', max: 16, heal: 20 },
    apple:       { name: 'Apfel',           type: 'food', icon: '🍎', max: 16, heal: 12 },
    monster_fang: { name: 'Monsterzahn',    type: 'material', icon: '🦷', max: 64, power: 3 },

    fist:        { name: 'Faust',           type: 'weapon', icon: '✊', max: 1, damage: 4, durability: Infinity, unbreakable: true },
    pickaxe:     { name: 'Spitzhacke',      type: 'weapon', icon: '⛏️', max: 1, damage: 5, durability: 60, isPick: true, mineMul: 3 },
    sword_wood:  { name: 'Holzschwert',     type: 'weapon', icon: '🗡️', max: 1, damage: 8, durability: 24 },
    sword_stone: { name: 'Steinschwert',    type: 'weapon', icon: '🗡️', max: 1, damage: 14, durability: 40, isPick: true, mineMul: 2 },
    sword_iron:  { name: 'Eisenschwert',    type: 'weapon', icon: '⚔️', max: 1, damage: 22, durability: 70 },
    sword_gold:  { name: 'Goldschwert',     type: 'weapon', icon: '⚔️', max: 1, damage: 26, durability: 55 },
    sword_crystal: { name: 'Kristallklinge', type: 'weapon', icon: '🔱', max: 1, damage: 38, durability: 100, glow: true },
    spear_fang:  { name: 'Zahnspeer',       type: 'weapon', icon: '🔱', max: 1, damage: 18, durability: 45 },
  };

  const FUSE_RECIPES = {
    'stick+stone':      'sword_stone',
    'stick+iron_chunk': 'sword_iron',
    'stick+gold_chunk': 'sword_gold',
    'stick+crystal':    'sword_crystal',
    'stick+monster_fang': 'spear_fang',
    'wood+wood':        { result: 'plank', count: 4 },
    'plank+plank':       { result: 'stick', count: 4 },
  };

  function fuseKey(a, b) {
    return [a, b].sort().join('+');
  }

  function tryFuse(idA, idB) {
    const key = fuseKey(idA, idB);
    let recipe = FUSE_RECIPES[key];
    if (recipe) {
      if (typeof recipe === 'string') return { result: recipe, count: 1, generic: false };
      return { result: recipe.result, count: recipe.count || 1, generic: false };
    }
    // Generic fallback: combine a "stick-like" handle with any material -> improvised fused weapon
    const a = ITEMS[idA], b = ITEMS[idB];
    if (!a || !b) return null;
    const powerA = a.power || (a.damage ? a.damage / 4 : 0);
    const powerB = b.power || (b.damage ? b.damage / 4 : 0);
    const dmg = Math.round(6 + (powerA + powerB) * 2.2);
    return {
      result: null,
      generic: true,
      generated: {
        name: `Fusion: ${a.name} + ${b.name}`,
        type: 'weapon',
        icon: '⚡',
        max: 1,
        damage: dmg,
        durability: 20 + Math.round((powerA + powerB) * 6),
        glow: true,
      },
    };
  }

  window.G = window.G || {};
  window.G.BLOCK = BLOCK;
  window.G.BLOCK_DATA = BLOCK_DATA;
  window.G.ITEMS = ITEMS;
  window.G.tryFuse = tryFuse;
})();
