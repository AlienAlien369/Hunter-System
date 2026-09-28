// Shareable Hunter card: a 1080×1350 image (Instagram portrait / WhatsApp friendly)
// drawn on a canvas in the browser, shared through the native share sheet.

export interface CardData {
  name: string;
  rank: string;
  level: number;
  xp: number;
  streak: number;
  weeklyXp: number;
  modules: string[];
  url: string;
}

const RANK_COLORS: Record<string, string> = { E: '#8A92B2', D: '#3498DB', C: '#8B5CF6', B: '#A855F7', A: '#F1C40F', S: '#F59E0B' };

/** The stat tiles shown on the card (pure, unit-tested). */
export function cardStats(d: CardData): { label: string; value: string }[] {
  return [
    { label: 'LEVEL', value: String(d.level) },
    { label: 'TOTAL XP', value: d.xp.toLocaleString('en-US') },
    { label: 'STREAK', value: `${d.streak} day${d.streak === 1 ? '' : 's'}` },
    { label: 'THIS WEEK', value: `+${d.weeklyXp.toLocaleString('en-US')} XP` },
  ];
}

export async function drawHunterCard(d: CardData): Promise<Blob> {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await Promise.all(['900 120px Orbitron', '700 44px Orbitron', '500 36px Inter'].map(f => document.fonts?.load(f).catch(() => undefined)));

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a0e1a');
  bg.addColorStop(0.55, '#1e1044');
  bg.addColorStop(1, '#0b1a44');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 470, 40, W / 2, 470, 520);
  glow.addColorStop(0, 'rgba(139,92,246,0.45)');
  glow.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const center = (text: string, y: number, font: string, color: string) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  };

  center('HUNTER SYSTEM', 130, '700 44px Orbitron', '#c4b5fd');
  center('STATUS WINDOW', 185, '500 30px Inter', 'rgba(255,255,255,0.55)');

  // Rank emblem
  const color = RANK_COLORS[d.rank] ?? '#8B5CF6';
  ctx.beginPath();
  ctx.arc(W / 2, 450, 170, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 50;
  ctx.stroke();
  ctx.shadowBlur = 0;
  center(d.rank, 505, '900 190px Orbitron', '#ffffff');
  center(`${d.rank}-RANK HUNTER`, 690, '700 40px Orbitron', color);
  center(d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name, 770, '700 64px Inter', '#ffffff');

  // Stat tiles (2×2)
  const stats = cardStats(d);
  const tileW = 440, tileH = 150, gap = 40, top = 840;
  stats.forEach((s, i) => {
    const x = (W - (tileW * 2 + gap)) / 2 + (i % 2) * (tileW + gap);
    const y = top + Math.floor(i / 2) * (tileH + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(167,139,250,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, tileW, tileH, 24);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '500 28px Inter';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(s.label, x + tileW / 2, y + 55);
    ctx.font = '700 50px Orbitron';
    ctx.fillStyle = '#fcd34d';
    ctx.fillText(s.value, x + tileW / 2, y + 118);
  });

  if (d.modules.length) center(d.modules.slice(0, 4).join('  ·  '), 1255, '500 30px Inter', 'rgba(255,255,255,0.7)');
  center(`Level up your life → ${d.url.replace(/^https?:\/\//, '')}`, 1310, '700 30px Inter', '#c4b5fd');

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render card'))), 'image/png'));
}

/** Share via the native share sheet when files are supported; otherwise download. Returns what happened. */
export async function shareHunterCard(blob: Blob, d: CardData): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], 'hunter-card.png', { type: 'image/png' });
  const text = `I'm a ${d.rank}-Rank Hunter (Level ${d.level}) with a ${d.streak}-day streak. Level up your life with me:`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Hunter card', text: `${text} ${d.url}` });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hunter-card.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
