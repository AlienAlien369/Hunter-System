import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LOCALES, loadLocale, useLocaleStore, type LocaleCode } from '../i18n';
import QuickStats from './QuickStats';
import RankProgress from './RankProgress';
import StatusWindow from './StatusWindow';
import BuildYourDay from './BuildYourDay';
import PerfectDayBanner from './PerfectDayBanner';
import StreakCalendar from './StreakCalendar';
import TrackReward from './TrackReward';

// Every translated component must render in every language without crashing, and in
// Hindi must show Devanagari rather than silently falling back to English.
beforeAll(async () => { await Promise.all(LOCALES.map(l => loadLocale(l.code))); });

const DEVANAGARI = /[ऀ-ॿ]/;
const cases: [string, () => JSX.Element][] = [
  ['QuickStats', () => <QuickStats />],
  ['RankProgress', () => <RankProgress />],
  ['StatusWindow', () => <StatusWindow />],
  ['BuildYourDay', () => <BuildYourDay />],
  ['PerfectDayBanner', () => <PerfectDayBanner />],
  ['StreakCalendar', () => <StreakCalendar />],
  ['TrackReward', () => <TrackReward quests={[{ xpReward: 10, done: false }]} currentXp={0} />],
];

describe('translated components render in every language', () => {
  for (const code of ['en', 'hi', 'hi-Latn'] as LocaleCode[]) {
    for (const [name, make] of cases) {
      it(`${name} renders in ${code}`, () => {
        useLocaleStore.setState({ locale: code });
        const { container, unmount } = render(<MemoryRouter>{make()}</MemoryRouter>);
        const text = container.textContent ?? '';
        if (name !== 'PerfectDayBanner') expect(text.length).toBeGreaterThan(0);
        if (code === 'hi' && name !== 'PerfectDayBanner') expect(text).toMatch(DEVANAGARI);
        unmount();
      });
    }
  }
});
