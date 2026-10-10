import { en, type MessageKey } from "../i18n/messages/en";
import type { StatThreshold } from "./xp";

type Translate = (key: MessageKey) => string;

/** Translated buff name/description for a stat tier; falls back to the English text for unknown tiers. */
export function buffText(t: Translate, stat: string, threshold: StatThreshold): { label: string; description: string } {
  const base = `buff.${stat}.${threshold.min}`;
  return {
    label: base in en ? t(base as MessageKey) : threshold.label,
    description: `${base}.desc` in en ? t(`${base}.desc` as MessageKey) : threshold.description,
  };
}
