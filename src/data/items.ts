// ─── Rarity Tiers ───────────────────────────────────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; glow: string; borderColor: string; bg: string }> = {
  common:   { label: 'Common',   color: 'text-gray-300',    glow: '',                          borderColor: 'border-gray-600/40',  bg: 'bg-gray-800/40' },
  rare:     { label: 'Rare',     color: 'text-blue-400',    glow: 'shadow-blue-500/20',        borderColor: 'border-blue-500/40',  bg: 'bg-blue-900/30' },
  epic:     { label: 'Epic',     color: 'text-purple-400',  glow: 'shadow-purple-500/30',      borderColor: 'border-purple-500/40', bg: 'bg-purple-900/30' },
  legendary:{ label: 'Legendary', color: 'text-yellow-400',  glow: 'shadow-yellow-500/30',      borderColor: 'border-yellow-500/40', bg: 'bg-yellow-900/30' },
};

// ─── Item Definitions ───────────────────────────────────────────────────────

export type ItemCategory = 'consumable' | 'scroll' | 'stone' | 'title';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: Rarity;
  category: ItemCategory;
  /** Effect when used. */
  effect: string;
}

export const ITEMS: Record<string, ItemDef> = {
  // ── Health Potions ──
  'health_potion': {
    id: 'health_potion',
    name: 'Health Potion',
    icon: '🧪',
    description: 'Recover 10 HP lost to penalties.',
    rarity: 'common',
    category: 'consumable',
    effect: 'Recover 10 HP',
  },
  'greater_health_potion': {
    id: 'greater_health_potion',
    name: 'Greater Health Potion',
    icon: '🧪',
    description: 'Recover 25 HP lost to penalties.',
    rarity: 'rare',
    category: 'consumable',
    effect: 'Recover 25 HP',
  },
  'supreme_health_potion': {
    id: 'supreme_health_potion',
    name: 'Supreme Health Potion',
    icon: '💎',
    description: 'Fully restore HP to 100.',
    rarity: 'epic',
    category: 'consumable',
    effect: 'Restore HP to 100',
  },

  // ── XP Boost Scrolls ──
  'xp_scroll': {
    id: 'xp_scroll',
    name: 'XP Scroll',
    icon: '📜',
    description: '+50% XP on your next quest completion.',
    rarity: 'common',
    category: 'scroll',
    effect: '+50% XP next quest',
  },
  'greater_xp_scroll': {
    id: 'greater_xp_scroll',
    name: 'Greater XP Scroll',
    icon: '📜',
    description: '+100% XP on your next quest completion.',
    rarity: 'rare',
    category: 'scroll',
    effect: '+100% XP next quest',
  },
  'legendary_xp_scroll': {
    id: 'legendary_xp_scroll',
    name: 'Legendary XP Scroll',
    icon: '✨',
    description: '+200% XP on your next quest completion.',
    rarity: 'epic',
    category: 'scroll',
    effect: '+200% XP next quest',
  },

  // ── Rank Stones ──
  'rank_stone': {
    id: 'rank_stone',
    name: 'Rank Stone',
    icon: '🔮',
    description: 'Grants 500 XP towards the next rank.',
    rarity: 'epic',
    category: 'stone',
    effect: '+500 XP',
  },
  'supreme_rank_stone': {
    id: 'supreme_rank_stone',
    name: 'Supreme Rank Stone',
    icon: '👑',
    description: 'Grants 1000 XP — enough to jump a rank threshold.',
    rarity: 'legendary',
    category: 'stone',
    effect: '+1000 XP',
  },

  // ── Title Scrolls ──
  'title_scroll_nightowl': {
    id: 'title_scroll_nightowl',
    name: 'Title: Night Owl',
    icon: '🦉',
    description: 'Equip the "Night Owl" title in your profile.',
    rarity: 'rare',
    category: 'title',
    effect: 'Unlock "Night Owl" title',
  },
  'title_scroll_duelsage': {
    id: 'title_scroll_duelsage',
    name: 'Title: Duel Sage',
    icon: '⚔️',
    description: 'Equip the "Duel Sage" title in your profile.',
    rarity: 'rare',
    category: 'title',
    effect: 'Unlock "Duel Sage" title',
  },
  'title_scroll_ironwill': {
    id: 'title_scroll_ironwill',
    name: 'Title: Iron Will',
    icon: '🛡️',
    description: 'Equip the "Iron Will" title in your profile.',
    rarity: 'epic',
    category: 'title',
    effect: 'Unlock "Iron Will" title',
  },
  'title_scroll_legend': {
    id: 'title_scroll_legend',
    name: 'Title: Living Legend',
    icon: '🌟',
    description: 'The rarest title in the System. Equip "Living Legend".',
    rarity: 'legendary',
    category: 'title',
    effect: 'Unlock "Living Legend" title',
  },
  'title_scroll_hunterking': {
    id: 'title_scroll_hunterking',
    name: 'Title: Hunter King',
    icon: '👑',
    description: 'Only the strongest earn this title. Equip "Hunter King".',
    rarity: 'legendary',
    category: 'title',
    effect: 'Unlock "Hunter King" title',
  },
};

// ─── Drop Table ─────────────────────────────────────────────────────────────

/** Drop chance per difficulty (1-3) and whether it's a hidden quest. */
interface DropEntry {
  itemId: string;
  /** Drop weight (higher = more likely). */
  weight: number;
  /** Minimum difficulty to drop (1 = always). */
  minDifficulty: number;
  /** Only drops from hidden quests. */
  hiddenOnly?: boolean;
}

const DROP_TABLE: DropEntry[] = [
  // Common consumables — drop from any quest
  { itemId: 'health_potion',        weight: 30, minDifficulty: 1 },
  { itemId: 'xp_scroll',           weight: 25, minDifficulty: 1 },

  // Rare drops — start at difficulty 2+
  { itemId: 'greater_health_potion', weight: 15, minDifficulty: 2 },
  { itemId: 'greater_xp_scroll',    weight: 12, minDifficulty: 2 },
  { itemId: 'title_scroll_nightowl', weight: 8,  minDifficulty: 2 },
  { itemId: 'title_scroll_duelsage', weight: 6,  minDifficulty: 2 },

  // Epic drops — difficulty 3+ only
  { itemId: 'supreme_health_potion', weight: 6,  minDifficulty: 3 },
  { itemId: 'legendary_xp_scroll',   weight: 5,  minDifficulty: 3 },
  { itemId: 'rank_stone',            weight: 4,  minDifficulty: 3 },
  { itemId: 'title_scroll_ironwill', weight: 3,  minDifficulty: 3 },

  // Legendary drops — hidden quest only (weight 1-2)
  { itemId: 'supreme_rank_stone',    weight: 2,  minDifficulty: 1, hiddenOnly: true },
  { itemId: 'title_scroll_legend',   weight: 1,  minDifficulty: 1, hiddenOnly: true },
  { itemId: 'title_scroll_hunterking', weight: 1, minDifficulty: 1, hiddenOnly: true },
];

/** Base drop chance — chance that ANY item drops at all (0-1). */
const BASE_DROP_CHANCE: Record<number, number> = {
  1: 0.15, // 15% for difficulty 1
  2: 0.30, // 30% for difficulty 2
  3: 0.50, // 50% for difficulty 3
};

/** Hidden quests always drop. */
const HIDDEN_QUEST_DROP_CHANCE = 1.0;

/**
 * Attempt to roll a loot drop after completing a quest.
 * Returns the item ID if something dropped, or null.
 */
export function rollDrop(difficulty: number, isHidden: boolean): string | null {
  const dropChance = isHidden ? HIDDEN_QUEST_DROP_CHANCE : (BASE_DROP_CHANCE[difficulty] ?? 0.15);
  if (Math.random() > dropChance) return null;

  // Filter eligible drops
  const eligible = DROP_TABLE.filter(entry => {
    if (entry.hiddenOnly && !isHidden) return false;
    if (difficulty < entry.minDifficulty) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Weighted random selection
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) return entry.itemId;
  }

  return eligible[eligible.length - 1].itemId;
}

/** XP amount granted by consumable scrolls (parsed from effect string). */
export function getScrollXpBonus(itemId: string): number {
  switch (itemId) {
    case 'xp_scroll':           return 0.5;  // +50%
    case 'greater_xp_scroll':   return 1.0;  // +100%
    case 'legendary_xp_scroll': return 2.0;  // +200%
    default:                    return 0;
  }
}

/** HP amount restored by potions. */
export function getPotionHeal(itemId: string): number {
  switch (itemId) {
    case 'health_potion':        return 10;
    case 'greater_health_potion': return 25;
    case 'supreme_health_potion': return 100;
    default:                     return 0;
  }
}

/** XP granted by rank stones. */
export function getStoneXp(itemId: string): number {
  switch (itemId) {
    case 'rank_stone':          return 500;
    case 'supreme_rank_stone':  return 1000;
    default:                    return 0;
  }
}

/** Unique inventory instance of an item. */
export interface InventoryItem {
  instanceId: string; // unique per drop
  itemId: string;     // references ITEMS key
  obtainedAt: string; // ISO timestamp
}

/** Currently equipped title (from an equipped title scroll). */
export interface EquippedLoadout {
  title: string | null;   // title name or null
  xpBoost: number;        // multiplier, 1 = no boost
  xpBoostQuestsLeft: number; // how many quests the boost lasts for
}

export const DEFAULT_LOADOUT: EquippedLoadout = {
  title: null,
  xpBoost: 1,
  xpBoostQuestsLeft: 0,
};

let instanceCounter = 0;
/** Generate a unique inventory instance ID. */
export function createInstanceId(): string {
  instanceCounter += 1;
  return `inv_${Date.now()}_${instanceCounter}`;
}

/** Title name from a title scroll. */
export function getTitleName(itemId: string): string {
  switch (itemId) {
    case 'title_scroll_nightowl':   return 'Night Owl';
    case 'title_scroll_duelsage':   return 'Duel Sage';
    case 'title_scroll_ironwill':   return 'Iron Will';
    case 'title_scroll_legend':     return 'Living Legend';
    case 'title_scroll_hunterking': return 'Hunter King';
    default:                        return '';
  }
}
