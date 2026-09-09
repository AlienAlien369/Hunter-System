import { calculateBMR, calculateTDEE, calculateTargetCalories, calculateProteinTotal } from '../utils/calorie';

describe('calorie calculations', () => {
  it('calculates male BMR with Mifflin-St Jeor', () => {
    expect(calculateBMR({ weightKg: 70, heightCm: 175, age: 25, sex: 'male' })).toBe(1674);
  });

  it('calculates female BMR with Mifflin-St Jeor', () => {
    expect(calculateBMR({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBe(1320);
  });

  it('calculates TDEE for moderate activity', () => {
    expect(calculateTDEE({ weightKg: 70, heightCm: 175, age: 25, sex: 'male', activityLevel: 'moderate', goal: 'maintain' })).toBeCloseTo(2595, 0);
  });

  it('applies lose goal by subtracting 500 calories', () => {
    expect(calculateTargetCalories({ weightKg: 70, heightCm: 175, age: 25, sex: 'male', activityLevel: 'moderate', goal: 'lose' })).toBeCloseTo(2095, 0);
  });

  it('applies gain goal by adding 400 calories', () => {
    expect(calculateTargetCalories({ weightKg: 70, heightCm: 175, age: 25, sex: 'male', activityLevel: 'moderate', goal: 'gain' })).toBeCloseTo(2995, 0);
  });

  it('sums consumed protein and ignores unconsumed items', () => {
    expect(calculateProteinTotal([
      { protein: 20, consumed: true },
      { protein: 10, consumed: false },
      { protein: 15, consumed: true },
    ])).toBe(35);
  });

  it('handles empty items', () => {
    expect(calculateProteinTotal([])).toBe(0);
  });
});
