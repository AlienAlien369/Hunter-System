export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface CalorieInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | 'other';
  activityLevel: ActivityLevel;
  goal: Goal;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export function calculateBMR({ weightKg, heightCm, age, sex }: Omit<CalorieInput, 'activityLevel' | 'goal'>): number {
  if (sex === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  if (sex === 'female') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return Math.round((10 * weightKg + 6.25 * heightCm - 5 * age - 161 + (10 * weightKg + 6.25 * heightCm - 5 * age + 5)) / 2);
}

export function calculateTDEE(input: CalorieInput): number {
  const bmr = calculateBMR(input);
  return Math.round(bmr * ACTIVITY_FACTORS[input.activityLevel]);
}

export function calculateTargetCalories(input: CalorieInput): number {
  const tdee = calculateTDEE(input);
  if (input.goal === 'lose') return Math.max(1200, Math.round(tdee - 500));
  if (input.goal === 'gain') return Math.round(tdee + 400);
  return tdee;
}

export function calculateProteinTotal(items: { protein: number; consumed: boolean }[]): number {
  return items.reduce((total, item) => (item.consumed ? total + item.protein : total), 0);
}
