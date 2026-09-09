import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dsaQuestions from '../data/dsa-questions.json';

type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface Question {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
}

const DIFFICULTY_CONFIG = {
  Easy: {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    badge: 'bg-green-500/20',
  },
  Medium: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    badge: 'bg-yellow-500/20',
  },
  Hard: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500/20',
  },
};

export default function DSARoadmap() {
  const [questions] = useState<Question[]>(dsaQuestions as Question[]);
  const [studied, setStudied] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'All' | Difficulty>('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Load studied questions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dsa_studied');
    if (saved) {
      setStudied(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save to localStorage when studied changes
  useEffect(() => {
    localStorage.setItem('dsa_studied', JSON.stringify([...studied]));
  }, [studied]);

  const toggleStudied = (id: number) => {
    setStudied(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredQuestions = filter === 'All'
    ? questions
    : questions.filter(q => q.difficulty === filter);

  const easyCount = questions.filter(q => q.difficulty === 'Easy').length;
  const mediumCount = questions.filter(q => q.difficulty === 'Medium').length;
  const hardCount = questions.filter(q => q.difficulty === 'Hard').length;
  const easyStudied = questions.filter(q => q.difficulty === 'Easy' && studied.has(q.id)).length;
  const mediumStudied = questions.filter(q => q.difficulty === 'Medium' && studied.has(q.id)).length;
  const hardStudied = questions.filter(q => q.difficulty === 'Hard' && studied.has(q.id)).length;
  const totalStudied = studied.size;

  const progress = (totalStudied / questions.length) * 100;

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
            DSA ROADMAP
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            LeetCode 75 — Master Data Structures & Algorithms
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-display text-gold font-bold">{totalStudied}<span className="text-gray-500 text-lg">/{questions.length}</span></p>
          <p className="text-xs text-gray-500 font-mono">QUESTS COMPLETED</p>
        </div>
      </motion.div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-white font-bold tracking-wider text-sm">
            PROGRESS OVERVIEW
          </h2>
          <span className="text-purple-400 font-mono text-sm">{progress.toFixed(1)}%</span>
        </div>

        {/* Overall Progress Bar */}
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        {/* Difficulty Stats */}
        <div className="grid grid-cols-3 gap-4">
          {/* Easy */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 font-mono text-xs uppercase">Easy</span>
              <span className="text-green-400 font-display font-bold">{easyStudied}/{easyCount}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${(easyStudied / easyCount) * 100}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>

          {/* Medium */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-400 font-mono text-xs uppercase">Medium</span>
              <span className="text-yellow-400 font-display font-bold">{mediumStudied}/{mediumCount}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-yellow-500"
                initial={{ width: 0 }}
                animate={{ width: `${(mediumStudied / mediumCount) * 100}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>

          {/* Hard */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 font-mono text-xs uppercase">Hard</span>
              <span className="text-red-400 font-display font-bold">{hardStudied}/{hardCount}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-500"
                initial={{ width: 0 }}
                animate={{ width: `${(hardStudied / hardCount) * 100}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex space-x-2"
      >
        {(['All', 'Easy', 'Medium', 'Hard'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 rounded-lg font-mono text-sm transition-all
              ${filter === f
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-[#161b22]/50 text-gray-500 hover:text-gray-300 border border-transparent'
              }
            `}
          >
            {f} {f !== 'All' && `(${questions.filter(q => q.difficulty === f).length})`}
          </button>
        ))}
      </motion.div>

      {/* Questions List */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filteredQuestions.map((question, index) => {
            const isStudied = studied.has(question.id);
            const isExpanded = expandedId === question.id;
            const config = DIFFICULTY_CONFIG[question.difficulty];

            return (
              <motion.div
                key={question.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.02 }}
                className={`
                  bg-[#161b22]/60 backdrop-blur-sm rounded-xl border transition-all
                  ${isStudied
                    ? `${config.bg} ${config.border} opacity-75`
                    : 'border-purple-500/10 hover:border-purple-500/30'
                  }
                `}
              >
                <div className="p-4">
                  <div className="flex items-center space-x-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleStudied(question.id)}
                      className={`
                        w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all flex-shrink-0
                        ${isStudied
                          ? `${config.bg} ${config.border}`
                          : 'border-gray-600 hover:border-purple-400 bg-transparent'
                        }
                      `}
                    >
                      {isStudied && (
                        <svg className={`w-4 h-4 ${config.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Question Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-500 font-mono text-sm">#{question.id}</span>
                        <h3 className={`
                          font-mono text-sm font-medium truncate
                          ${isStudied ? 'text-gray-500 line-through' : 'text-white'
                          }
                        `}>
                          {question.title}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full font-mono border
                          ${config.bg} ${config.color} ${config.border}
                        `}>
                          {question.difficulty}
                        </span>
                      </div>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : question.id)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Description (Expandable) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 pl-10 border-t border-purple-500/10 mt-3">
                          <p className="text-gray-400 font-mono text-sm leading-relaxed">
                            {question.description}
                          </p>
                          <div className="mt-3 flex space-x-2">
                            <a
                              href={`https://leetcode.com/problems/${question.title.toLowerCase().replace(/\s+/g, '-')}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded border border-purple-500/20 transition-colors font-mono"
                            >
                              View on LeetCode →
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-purple-500/10">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-500 font-mono text-xs">Easy</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-500 font-mono text-xs">Medium</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-500 font-mono text-xs">Hard</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-gray-500 font-mono text-xs">Studied</span>
        </div>
      </div>
    </div>
  );
}
