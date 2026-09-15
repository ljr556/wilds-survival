// 物品、配方、建筑、生物、天气的定义表

export const ITEMS = {
  wood:        { name: '木材',     icon: 'icon_wood.png',     stack: 50 },
  stone:       { name: '石头',     icon: 'icon_stone.png',    stack: 50 },
  fiber:       { name: '植物纤维', icon: 'icon_fiber.png',    stack: 50 },
  flint:       { name: '燧石',     icon: 'icon_flint.png',    stack: 30 },
  stick:       { name: '木棍',     icon: 'icon_stick.png',    stack: 50 },
  rope:        { name: '绳索',     icon: 'icon_rope.png',     stack: 30 },
  berry:       { name: '浆果',     icon: 'icon_berry.png',    stack: 30, food: 8,  water: 3, warm: 0 },
  mushroom:    { name: '蘑菇',     icon: 'icon_mushroom.png', stack: 30, food: 6,  water: 2, risk: 0.12 },
  raw_meat:    { name: '生肉',     icon: 'icon_rawmeat.png',  stack: 20, food: 14, water: 2, risk: 0.2 },
  cooked_meat: { name: '熟肉',     icon: 'icon_meat.png',     stack: 20, food: 38, water: 4 },
  hide:        { name: '兽皮',     icon: 'icon_hide.png',     stack: 30 },
  iron_ore:    { name: '铁矿石',   icon: 'icon_ironore.png',  stack: 40 },
  iron_ingot:  { name: '铁锭',     icon: 'icon_ingot.png',    stack: 30 },
  coal:        { name: '煤炭',     icon: 'icon_coal.png',     stack: 40 },
  steel_ingot: { name: '钢锭',     icon: 'icon_ingot.png',    stack: 20 },
  water_flask: { name: '水囊',     icon: 'icon_flask.png',    stack: 1,  water: 26 },
  clean_water: { name: '净水',     icon: 'icon_flask.png',    stack: 1, water: 45 },
  bandage:     { name: '绷带',     icon: 'icon_bandage.png',  stack: 10, heal: 32 },
  torch:       { name: '火把',     icon: 'icon_torch.png',    stack: 5, light: true },
  axe_stone:   { name: '石斧',     icon: 'icon_axestone.png', stack: 1, tool: 'axe',   tier: 1, chop: 2.2, damage: 12 },
  axe_iron:    { name: '铁斧',     icon: 'icon_axeiron.png',  stack: 1, tool: 'axe',   tier: 2, chop: 3.6, damage: 18 },
  axe_steel:   { name: '钢斧',     icon: 'icon_axesteel.png', stack: 1, tool: 'axe',   tier: 3, chop: 5.2, damage: 26 },
  pick_stone:  { name: '石镐',     icon: 'icon_pickstone.png', stack: 1, tool: 'pick', tier: 1, mine: 2.2, damage: 11 },
  pick_iron:   { name: '铁镐',     icon: 'icon_pickiron.png',  stack: 1, tool: 'pick', tier: 2, mine: 3.6, damage: 16 },
  spear_wood:  { name: '木矛',     icon: 'icon_spearwood.png', stack: 1, tool: 'spear', tier: 1, damage: 16, reach: 3.0 },
  spear_iron:  { name: '铁矛',     icon: 'icon_speariron.png', stack: 1, tool: 'spear', tier: 2, damage: 26, reach: 3.2 },
  sword_steel: { name: '钢剑',     icon: 'icon_swordsteel.png', stack: 1, tool: 'sword', tier: 3, damage: 38, reach: 2.8 },
  hide_armor:  { name: '兽皮衣',   icon: 'icon_hidearmor.png', stack: 1, armor: 0.18, warm: 6 },
  iron_armor:  { name: '铁甲',     icon: 'icon_ironarmor.png', stack: 1, armor: 0.38, warm: 4 },
  campfire:    { name: '篝火',     icon: 'icon_campfire.png',  stack: 5, place: 'campfire' },
  workbench:   { name: '工作台',   icon: 'icon_workbench.png', stack: 5, place: 'workbench' },
  wall_wood:   { name: '木墙',     icon: 'icon_wall.png',      stack: 20, place: 'wall_wood' },
  shelter:     { name: '棚屋',     icon: 'icon_shelter.png',   stack: 3, place: 'shelter' },
};

// station: null=徒手, 'bench'=工作台, 'fire'=篝火
export const RECIPES = [
  { out: 'stick',       count: 2, cost: { wood: 1 },                       station: null,  cat: '基础' },
  { out: 'rope',        count: 1, cost: { fiber: 3 },                      station: null,  cat: '基础' },
  { out: 'torch',       count: 1, cost: { stick: 1, fiber: 2 },            station: null,  cat: '基础' },
  { out: 'axe_stone',   count: 1, cost: { stick: 1, stone: 2, fiber: 2 },  station: null,  cat: '工具' },
  { out: 'pick_stone',  count: 1, cost: { stick: 1, stone: 3, fiber: 2 },  station: null,  cat: '工具' },
  { out: 'spear_wood',  count: 1, cost: { stick: 2, fiber: 1 },            station: null,  cat: '工具' },
  { out: 'bandage',     count: 2, cost: { fiber: 5 },                      station: null,  cat: '生存' },
  { out: 'water_flask', count: 1, cost: { hide: 2, rope: 1 },              station: 'bench', cat: '生存' },
  { out: 'campfire',    count: 1, cost: { wood: 8, stone: 4 },             station: null,  cat: '建筑' },
  { out: 'workbench',   count: 1, cost: { wood: 12, stone: 6 },            station: null,  cat: '建筑' },
  { out: 'wall_wood',   count: 1, cost: { wood: 6 },                       station: null,  cat: '建筑' },
  { out: 'shelter',     count: 1, cost: { wood: 22, fiber: 12, rope: 2 },  station: 'bench', cat: '建筑' },
  { out: 'iron_ingot',  count: 1, cost: { iron_ore: 2, coal: 1 },          station: 'fire',  cat: '冶炼' },
  { out: 'cooked_meat', count: 1, cost: { raw_meat: 1 },                   station: 'fire',  cat: '冶炼' },
  { out: 'clean_water', count: 1, cost: { water_flask: 1 },                station: 'fire',  cat: '冶炼' },
  { out: 'steel_ingot', count: 1, cost: { iron_ingot: 2, coal: 2 },        station: 'fire',  cat: '冶炼' },
  { out: 'axe_iron',    count: 1, cost: { axe_stone: 1, iron_ingot: 2, rope: 1 },  station: 'bench', cat: '工具 II' },
  { out: 'pick_iron',   count: 1, cost: { pick_stone: 1, iron_ingot: 2, rope: 1 }, station: 'bench', cat: '工具 II' },
  { out: 'spear_iron',  count: 1, cost: { spear_wood: 1, iron_ingot: 2 },          station: 'bench', cat: '工具 II' },
  { out: 'axe_steel',   count: 1, cost: { axe_iron: 1, steel_ingot: 2, rope: 1 },  station: 'bench', cat: '工具 III' },
  { out: 'sword_steel', count: 1, cost: { steel_ingot: 2, iron_ingot: 2, rope: 1 }, station: 'bench', cat: '工具 III' },
  { out: 'hide_armor',  count: 1, cost: { hide: 6, rope: 2 },              station: 'bench', cat: '装备' },
  { out: 'iron_armor',  count: 1, cost: { iron_ingot: 6, hide: 2, rope: 1 }, station: 'bench', cat: '装备' },
];

export const STRUCTURES = {
  campfire:  { item: 'campfire',  name: '篝火',   radius: 1.1, warm: 24, light: 9,  cook: true },
  workbench: { item: 'workbench', name: '工作台', radius: 1.4, bench: true },
  wall_wood: { item: 'wall_wood', name: '木墙',   radius: 1.0, blocks: true },
  shelter:   { item: 'shelter',   name: '棚屋',   radius: 2.4, sleep: true },
};

export const CREATURES = {
  rabbit: { name: '野兔', hp: 12,  speed: 3.4, size: 0.5,  hostile: false, flee: 9,  drops: { raw_meat: 1, hide: 1 }, meat: 1 },
  deer:   { name: '鹿',   hp: 34,  speed: 4.6, size: 1.4,  hostile: false, flee: 12, drops: { raw_meat: 2, hide: 2 }, meat: 2 },
  boar:   { name: '野猪', hp: 52,  speed: 3.8, size: 1.1,  hostile: false, aggro: 8, damage: 12, drops: { raw_meat: 3, hide: 2 }, meat: 2.5 },
  wolf:   { name: '夜狼', hp: 46,  speed: 5.2, size: 1.0,  hostile: true,  aggro: 26, damage: 9,  drops: { raw_meat: 2, hide: 1 }, night: true },
  brute:  { name: '林魈', hp: 110, speed: 4.2, size: 1.8,  hostile: true,  aggro: 30, damage: 18, drops: { hide: 3, raw_meat: 2, coal: 2 }, night: true },
};

export const WEATHERS = {
  clear:  { name: '晴',     sky: 0x9dc6e8, fog: 0.0016, rain: 0,   cold: 0,  light: 1.0 },
  cloudy: { name: '多云',   sky: 0x8fa3ad, fog: 0.0026, rain: 0,   cold: 2,  light: 0.82 },
  rain:   { name: '下雨',   sky: 0x6f8189, fog: 0.0042, rain: 1,   cold: 8,  light: 0.62 },
  storm:  { name: '雷暴',   sky: 0x4e5a63, fog: 0.0056, rain: 1.6, cold: 12, light: 0.5, lightning: true },
  fog:    { name: '浓雾',   sky: 0xa8b4b0, fog: 0.010,  rain: 0,   cold: 5,  light: 0.72 },
};

export const RECIPE_BY_OUT = RECIPES.reduce((acc, r) => { acc[r.out] = r; return acc; }, {});

export const PLACEABLES = ['campfire', 'workbench', 'wall_wood', 'shelter'];

// 采掘产出表：不同资源节点掉落
export const NODE_DROPS = {
  tree:  { tool: 'axe',  hits: 3, drops: { wood: 3, stick: 1 }, regrow: 210 },
  rock:  { tool: 'pick', hits: 3, drops: { stone: 3, flint: 1 }, regrow: 260 },
  iron:  { tool: 'pick', hits: 4, drops: { iron_ore: 3, stone: 1 }, regrow: 420 },
  coal:  { tool: 'pick', hits: 4, drops: { coal: 3, stone: 1 }, regrow: 420 },
  bush:  { tool: null,   hits: 1, drops: { berry: 3, fiber: 2 }, regrow: 150 },
  plant: { tool: null,   hits: 1, drops: { fiber: 3 }, regrow: 120 },
};
