import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { ITEMS, RARITY_CONFIG, type Rarity, type InventoryItem } from '../data/items';

const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

function ItemCard({ invItem, onUse }: { invItem: InventoryItem; onUse: (instanceId: string) => void }) {
  const def = ITEMS[invItem.itemId];
  if (!def) return null;
  const rarity = RARITY_CONFIG[def.rarity as Rarity];

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onUse(invItem.instanceId)}
      className={`
        relative text-left p-4 rounded-xl border transition-all cursor-pointer
        ${rarity.bg} ${rarity.borderColor}
        hover:shadow-lg hover:shadow-purple-500/5
      `}
    >
      {/* Rarity indicator strip */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
        style={{
          background: def.rarity === 'legendary' ? '#facc15'
            : def.rarity === 'epic' ? '#a855f7'
              : def.rarity === 'rare' ? '#3b82f6'
                : '#6b7280',
        }}
      />

      {/* Icon */}
      <span className="text-3xl block mb-2">{def.icon}</span>

      {/* Name */}
      <p className={`font-display font-bold text-sm leading-tight ${rarity.color}`}>
        {def.name}
      </p>

      {/* Rarity badge */}
      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono ${rarity.color} ${rarity.bg} border ${rarity.borderColor}`}>
        {rarity.label}
      </span>

      {/* Effect */}
      <p className="text-[10px] font-mono text-gray-500 mt-2 leading-snug">
        {def.effect}
      </p>

      {/* Use hint */}
      <p className="text-[9px] font-mono text-purple-400/60 mt-2">
        TAP TO USE
      </p>
    </motion.button>
  );
}

function TitleCard({ title, isActive, onEquip, onUnequip }: {
  title: string;
  isActive: boolean;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`
        flex items-center justify-between p-3 rounded-xl border transition-all
        ${isActive
          ? 'bg-purple-500/15 border-purple-500/40'
          : 'bg-gray-800/30 border-gray-700/30 hover:border-gray-600/40'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">🏷️</span>
        <div>
          <p className={`font-display text-sm font-bold ${isActive ? 'text-purple-400' : 'text-gray-300'}`}>
            {title}
          </p>
          {isActive && (
            <p className="text-[10px] font-mono text-purple-400/60">EQUIPPED</p>
          )}
        </div>
      </div>
      <button
        onClick={isActive ? onUnequip : onEquip}
        className={`px-3 py-1 rounded-lg font-mono text-xs border transition-all ${
          isActive
            ? 'bg-gray-800/60 text-gray-400 border-gray-700/50 hover:text-white'
            : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
        }`}
      >
        {isActive ? 'UNEQUIP' : 'EQUIP'}
      </button>
    </motion.div>
  );
}

export default function Inventory() {
  const { inventory, equipped, unlockedTitles, useItem: consumeItem, equipTitle, unequipTitle, deactivateXpBoost } = useGameStore();
  const [activeTab, setActiveTab] = useState<'items' | 'titles' | 'boost'>('items');
  const [filterRarity, setFilterRarity] = useState<Rarity | 'all'>('all');
  const [confirmUse, setConfirmUse] = useState<InventoryItem | null>(null);

  // Group inventory by item ID and count
  const grouped = inventory.reduce<Record<string, { item: InventoryItem; count: number }>>((acc, inv) => {
    if (!acc[inv.itemId]) acc[inv.itemId] = { item: inv, count: 0 };
    acc[inv.itemId].count++;
    return acc;
  }, {});

  // Sort by rarity then name
  const sortedEntries = Object.values(grouped).sort((a, b) => {
    const idxA = RARITY_ORDER.indexOf(ITEMS[a.item.itemId]?.rarity as Rarity);
    const idxB = RARITY_ORDER.indexOf(ITEMS[b.item.itemId]?.rarity as Rarity);
    if (idxA !== idxB) return idxA - idxB;
    return (ITEMS[a.item.itemId]?.name ?? '').localeCompare(ITEMS[b.item.itemId]?.name ?? '');
  });

  const filteredEntries = filterRarity === 'all'
    ? sortedEntries
    : sortedEntries.filter(e => ITEMS[e.item.itemId]?.rarity === filterRarity);

  const handleUse = (item: InventoryItem) => {
    const def = ITEMS[item.itemId];
    if (def?.category === 'title') {
      // Title scrolls: equip/unequip
      const titleName = unlockedTitles.find(t => t === (def.name.replace('Title: ', '')));
      if (equipped.title === titleName) {
        unequipTitle();
      } else if (titleName) {
        equipTitle(item.itemId);
      } else {
        // First time using a title scroll
        consumeItem(item.itemId);
      }
    } else {
      setConfirmUse(item);
    }
  };

  const confirmUseItem = () => {
    if (confirmUse) {
      consumeItem(confirmUse.instanceId);
      setConfirmUse(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">
            INVENTORY
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            {inventory.length} item{inventory.length !== 1 ? 's' : ''} collected
          </p>
        </div>

        {/* Active boost indicator */}
        {equipped.xpBoost > 1 && equipped.xpBoostQuestsLeft > 0 && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-4 py-2 rounded-xl border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 font-mono text-sm"
          >
            ⚡ {equipped.xpBoost > 2 ? '+200%' : equipped.xpBoost > 1.5 ? '+100%' : '+50%'} XP • {equipped.xpBoostQuestsLeft} quest{equipped.xpBoostQuestsLeft !== 1 ? 's' : ''} left
            <button
              onClick={deactivateXpBoost}
              className="ml-2 text-xs text-gray-500 hover:text-white transition-colors"
            >
              [deactivate]
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/60 rounded-lg p-1 w-fit">
        {([
          { id: 'items' as const, label: 'ITEMS', icon: '🎒' },
          { id: 'titles' as const, label: 'TITLES', icon: '🏷️' },
          { id: 'boost' as const, label: 'EQUIPPED', icon: '⚡' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md font-display text-xs transition-all ${
              activeTab === tab.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Rarity filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterRarity('all')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                filterRarity === 'all' ? 'bg-gray-700/60 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              All ({inventory.length})
            </button>
            {RARITY_ORDER.map(r => {
              const count = inventory.filter(i => ITEMS[i.itemId]?.rarity === r).length;
              if (count === 0) return null;
              return (
                <button
                  key={r}
                  onClick={() => setFilterRarity(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                    filterRarity === r ? `${RARITY_CONFIG[r].bg} ${RARITY_CONFIG[r].color}` : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {RARITY_CONFIG[r].label} ({count})
                </button>
              );
            })}
          </div>

          {/* Item grid */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3">🎒</span>
              <p className="text-gray-400 font-mono text-sm">
                {inventory.length === 0 ? 'No items yet — complete quests to find loot!' : 'No items match this filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredEntries.map(({ item, count }) => (
                <div key={item.itemId} className="relative">
                  <ItemCard invItem={item} onUse={() => handleUse(item)} />
                  {count > 1 && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-gray-800/80 text-[10px] font-mono text-gray-400 border border-gray-700/50">
                      ×{count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Titles Tab */}
      {activeTab === 'titles' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {unlockedTitles.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3">🏷️</span>
              <p className="text-gray-400 font-mono text-sm">
                No titles unlocked — find title scrolls in loot drops!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unlockedTitles.map(title => (
                <TitleCard
                  key={title}
                  title={title}
                  isActive={equipped.title === title}
                  onEquip={() => {
                    const scrollId = Object.keys(ITEMS).find(k => ITEMS[k].category === 'title' && ITEMS[k].name === `Title: ${title}`);
                    if (scrollId) equipTitle(scrollId);
                  }}
                  onUnequip={unequipTitle}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Equipped Tab */}
      {activeTab === 'boost' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
            <h3 className="font-display text-white font-bold tracking-wider text-sm mb-4">ACTIVE LOADOUT</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title slot */}
              <div className="p-4 rounded-xl border border-gray-700/30 bg-gray-800/20">
                <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-2">TITLE</p>
                {equipped.title ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏷️</span>
                      <p className="font-display text-sm font-bold text-purple-400">{equipped.title}</p>
                    </div>
                    <button
                      onClick={unequipTitle}
                      className="text-xs font-mono text-gray-500 hover:text-white transition-colors"
                    >
                      UNEQUIP
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 font-mono">No title equipped</p>
                )}
              </div>

              {/* XP Boost slot */}
              <div className="p-4 rounded-xl border border-gray-700/30 bg-gray-800/20">
                <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-2">XP BOOST</p>
                {equipped.xpBoost > 1 && equipped.xpBoostQuestsLeft > 0 ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚡</span>
                      <div>
                        <p className="font-display text-sm font-bold text-yellow-400">
                          +{Math.round((equipped.xpBoost - 1) * 100)}% XP
                        </p>
                        <p className="text-[10px] font-mono text-gray-500">
                          {equipped.xpBoostQuestsLeft} quest{equipped.xpBoostQuestsLeft !== 1 ? 's' : ''} remaining
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={deactivateXpBoost}
                      className="text-xs font-mono text-gray-500 hover:text-white transition-colors"
                    >
                      DEACTIVATE
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 font-mono">No boost active</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Use confirmation modal */}
      <AnimatePresence>
        {confirmUse && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[80]"
              onClick={() => setConfirmUse(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[81] flex items-center justify-center p-4"
            >
              <div className="bg-[#0d1117] border border-purple-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl shadow-purple-500/10">
                <div className="text-center">
                  {(() => {
                    const def = ITEMS[confirmUse.itemId];
                    if (!def) return null;
                    const rarity = RARITY_CONFIG[def.rarity as Rarity];
                    return (
                      <>
                        <span className="text-5xl block mb-3">{def.icon}</span>
                        <p className={`text-[10px] font-mono tracking-widest ${rarity.color} mb-1`}>
                          {rarity.label.toUpperCase()}
                        </p>
                        <h3 className="text-lg font-display text-white font-bold mb-2">{def.name}</h3>
                        <p className="text-sm text-gray-400 mb-1">{def.description}</p>
                        <p className="text-xs text-purple-400 font-mono mb-4">Effect: {def.effect}</p>
                      </>
                    );
                  })()}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmUse(null)}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 font-display text-sm hover:bg-gray-800 transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={confirmUseItem}
                      className="flex-1 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 font-display text-sm font-bold hover:bg-purple-500/30 transition-colors"
                    >
                      USE ITEM
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
