import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend } from 'recharts';
import { calculateTargetCalories, calculateTDEE, calculateProteinTotal } from '../utils/calorie';

const FOODS = [
  { name: 'Fit Feast Pouch', protein: 20, cost: 20, unit: 'daily' },
  { name: 'Nandini Milk 500ml', protein: 16, cost: 6, unit: 'daily' },
  { name: 'Pintola Oats 50g', protein: 6, cost: 2.5, unit: 'daily' },
  { name: 'Milky Mist Paneer 150g', protein: 27, cost: 40, unit: 'daily' },
  { name: 'Roasted Chana 30g', protein: 6, cost: 3.5, unit: 'daily' },
  { name: 'Peanuts 20g', protein: 5, cost: 2.5, unit: 'daily' },
  { name: 'Company Buffet', protein: 18, cost: 55, unit: 'weekday' },
  { name: 'Saturday Extra Meal', protein: 20, cost: 90, unit: 'saturday' },
  { name: 'Sunday Udupi Meal', protein: 40, cost: 180, unit: 'sunday' },
];

const BUDGET_ITEMS = [
  { category: 'Fit Feast Pouches', target: 1800 },
  { category: 'Nandini Milk', target: 900 },
  { category: 'Pintola Oats', target: 250 },
  { category: 'Milky Mist Paneer', target: 3600 },
  { category: 'Roasted Chana & Peanuts', target: 470 },
  { category: 'Company Buffet Meals', target: 1210 },
  { category: 'Weekend Dining Out', target: 1500 },
  { category: 'Startup Events', target: 1500 },
  { category: 'Local Transport', target: 1000 },
  { category: 'Buffer', target: 1000 },
];

const PROTEIN_GOAL_G = 150;

type CalorieGoal = 'lose' | 'maintain' | 'gain';

export default function NutritionBudget() {
  const {
    logNutrition,
    profile,
  } = useGameStore();
  const [foods, setFoods] = useState(() =>
    FOODS.map(food => ({ ...food, consumed: false }))
  );
  const [budget] = useState(() =>
    BUDGET_ITEMS.map(item => ({ ...item, actual: 0 }))
  );
  const [proteinData, setProteinData] = useState([]);
  const selectedDate = new Date().toISOString().split('T')[0];
  const goal: CalorieGoal = 'maintain';

  // Load nutrition data from storage on mount
  useEffect(() => {
    setProteinData([]);
  }, []);

  // Derive simple profile defaults if missing
  const weightKg = Number.isFinite(profile?.weightKg) ? (profile as any).weightKg : 70;
  const heightCm = Number.isFinite(profile?.heightCm) ? (profile as any).heightCm : 170;
  const age = Number.isFinite(profile?.age) ? (profile as any).age : 25;
  const sex = (profile?.sex as 'male' | 'female' | 'other') || 'male';
  const activityLevel = ((profile?.activityLevel as any) || 'moderate') as 'moderate';

  const tdee = calculateTDEE({ weightKg, heightCm, age, sex, activityLevel, goal: 'maintain' });
  const targetCalories = calculateTargetCalories({ weightKg, heightCm, age, sex, activityLevel, goal });
  const totalProtein = calculateProteinTotal(foods);

  // Calculate budget progress
  const budgetProgress = budget.map(item => ({
    ...item,
    progress: Math.min((item.actual / item.target) * 100, 100)
  }));

  const handleToggleFood = (food: typeof FOODS[0]) => {
    setFoods(prev => prev.map(f =>
      f.name === food.name ? { ...f, consumed: !f.consumed } : f
    ));

    // Log nutrition when food is toggled
    const consumedFoods = foods.filter(f => f.consumed);
    logNutrition(selectedDate, consumedFoods.map(f => ({
      name: f.name,
      protein: f.protein,
      cost: f.cost,
      consumed: true
    })));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-[calc(100vh-64px)] p-6"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-display text-purple-monarch flex items-center space-x-3">
          NUTRITION & BUDGET
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Food Tracking Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6"
        >
          <h2 className="text-xl font-display text-purple-monarch mb-4">
            DAILY NUTRITION TRACKER
          </h2>

          <div className="space-y-3">
            {foods.map((food, index) => (
              <motion.div
                key={food.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
                className="flex items-center space-x-3 p-3 bg-dungeon/50 rounded-hover hover:bg-purple-monarch/10 transition-colors cursor-pointer"
                onClick={() => handleToggleFood(food)}
              >
                <div className="w-5 h-5 flex-shrink-0">
                  {food.consumed ? (
                    <svg className="text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 5h22M1 12h22M1 19h22" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-display text-sm">{food.name}</h3>
                  <p className="text-xs text-muted flex items-center space-x-2">
                    <span className="w-6 text-center">{food.protein}g</span>
                    <span>₹{food.cost}</span>
                  </p>
                </div>
                <div className="w-8 text-sm text-muted text-center">
                  {food.consumed ? '✓' : '○'}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-purple-monarch/10">
            <div className="flex justify-between text-sm text-muted mb-1">
              <span>TDEE</span>
              <span>{tdee} kcal</span>
            </div>
            <div className="flex justify-between text-sm text-muted mb-3">
              <span>Target ({goal})</span>
              <span>{targetCalories} kcal</span>
            </div>
            <div className="flex justify-between text-sm text-muted mb-1">
              <span>Daily Protein Goal</span>
              <span>{totalProtein}g / {PROTEIN_GOAL_G}g</span>
            </div>
            <div className="w-full bg-dungeon/50 rounded-full h-3 mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-success to-green-success/50 transition-all duration-500"
                style={{ width: `${Math.min((totalProtein / PROTEIN_GOAL_G) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </motion.div>

        {/* Protein Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6"
        >
          <h2 className="text-xl font-display text-purple-monarch mb-4">
            PROTEIN TREND
          </h2>

          <div className="h-48 w-full">
            {proteinData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proteinData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="protein" fill="#8E2DE2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                No data available yet
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Budget Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6"
      >
        <h2 className="text-xl font-display text-purple-monarch mb-4">
          MONTHLY BUDGET TRACKER
        </h2>

        <div className="space-y-4">
          {budgetProgress.map((item, index) => (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * index }}
              className="space-y-2"
            >
              <div className="flex justify-between items-start text-sm">
                <span className="font-mono">{item.category}</span>
                <span className="text-muted">₹{item.actual} / ₹{item.target}</span>
              </div>
              <div className="w-full bg-dungeon/50 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-monarch to-purple-glow transition-all duration-500"
                  style={{ width: `${item.progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>{item.progress.toFixed(0)}%</span>
                <span>{item.progress >= 100 ? 'OVER' : 'UNDER'}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-purple-monarch/10">
          <div className="space-y-3">
            {budgetProgress.map((item) => (
              <div key={item.category} className="flex items-center space-x-3 p-2 bg-dungeon/50 rounded">
                <div className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.progress >= 100 ? '#E74C3C' : '#2ECC71' }}></div>
                <div className="flex-1">
                  <span className="font-mono text-sm">{item.category}</span>
                </div>
                <div className="w-10 text-sm text-right">
                  ₹{item.actual}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Budget Distribution Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6"
      >
        <h2 className="text-xl font-display text-purple-monarch mb-4">
          BUDGET DISTRIBUTION
        </h2>

        <div className="h-48 w-full">
          {budgetProgress.some(item => item.actual > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <PieTooltip />
                <PieLegend />
                <Pie
                  data={budgetProgress.filter(item => item.actual > 0)}
                  dataKey="actual"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius="60"
                  outerRadius="80"
                  labelLine={{ stroke: '#8E2DE2', strokeWidth: 1 }}
                  label={{ position: 'outside', fontSize: 10 }}
                >
                  {budgetProgress.map((item, index) => (
                    <Cell
                      key={`cell-${item.category}-${index}`}
                      fill={index % 2 === 0 ? '#8E2DE2' : '#5D26C1'}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              No budget data available yet
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}