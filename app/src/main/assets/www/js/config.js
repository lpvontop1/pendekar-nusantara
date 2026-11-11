// ===== Konstanta global game =====
const CFG = {
  TILE: 32,
  VIEW_W: 480,
  VIEW_H: 270,
  WORLD_H_TILES: 18,

  // fisika player
  GRAVITY: 1680,
  MAX_FALL: 560,
  ACCEL: 900,
  AIR_ACCEL: 640,
  FRICTION: 1100,
  AIR_DRAG: 180,
  MAX_SPEED: 118,
  JUMP_VEL: 520,
  JUMP_CUT: 0.45,
  COYOTE: 0.10,
  BUFFER: 0.12,
  STOMP_BOUNCE: 340,

  // dash
  DASH_SPEED: 340,
  DASH_TIME: 0.16,
  DASH_COST: 22,
  DASH_CD: 0.30,

  // stamina
  STAM_MAX: 100,
  STAM_REGEN: 34,
  STAM_DELAY: 0.35,

  // hp
  HP_BASE: 3,
  HP_MAX: 5,
  IFRAMES: 1.0,

  // musuh dasar
  BUTA_SPEED: 42,
  TUYUL_SPEED: 84,
  KUNTI_SPEED: 55,
  FIRE_CD: 2.4,

  // ekonomi
  BONUS_BASE: 10,
  BONUS_PER_LEVEL: 2,
  BOSS_BONUS: 150,

  // toko
  SHOP: [
    { id: 'jamu',    icon: 'jamu',    name: 'Jamu Nyamil',      desc: 'Pulihkan seluruh nyawa sekarang',   price: 12,  kind: 'heal' },
    { id: 'kopi',    icon: 'kopi',    name: 'Kopi Tubruk',      desc: 'Isi stamina penuh, regen 2x selama 30 dtk', price: 8,  kind: 'kopi' },
    { id: 'stam2',   icon: 'amulet',  name: 'Roh Kelapa',       desc: 'Stamina maksimum jadi 2x kali (permanen)', price: 60,  kind: 'up-stam' },
    { id: 'jump',    icon: 'feather', name: 'Bulu Rajawali',    desc: 'Lompatan lebih tinggi +12% (permanen)', price: 80,  kind: 'up-jump' },
    { id: 'speed',   icon: 'sandal',  name: 'Sandal Angin',     desc: 'Lari lebih cepat +25% (permanen)',  price: 80,  kind: 'up-speed' },
    { id: 'heart',   icon: 'heart',   name: 'Jantung Waja',     desc: '+1 nyawa maksimum (permanen, sampai 5)', price: 90, kind: 'up-heart' },
  ],

  BIOMES: ['jungle', 'temple', 'volcano'],
  BOSS_CYCLE: ['rangda', 'kala', 'naga'],
  BOSS_INFO: {
    rangda: { name: 'RANGDA', sub: 'Ratu Para Leyak' },
    kala:   { name: 'KALA RAU', sub: 'Pemakan Bulan' },
    naga:   { name: 'NAGA BESUKI', sub: 'Sang Ula Emas' },
  },
  SAFE: {
    // aturan lompatan maksimum (tile) — dipakai generator & validator
    FLAT_GAP: 2,
    UP1_GAP: 1,
    UP2_GAP: 1,
    DOWN_GAP: 2,
    UP1: 1,
    UP2: 2,
    DOWN_MAX: 3,
  },
};
