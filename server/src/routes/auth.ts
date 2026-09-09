import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../activity.js';
import { calculateLevel, calculateRank } from '../progression.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'hunter-system-secret-key-2024';
const JWT_EXPIRES_IN = '1h';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, name)
       VALUES ($1, $2, $3) RETURNING id, username, name, created_at`,
      [username, password_hash, username]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    await logActivity(user.id, 'register', user.username);

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, username: user.username, name: user.name },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Compare password with hash
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT with user id and username
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    await logActivity(user.id, 'login', user.username);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /api/auth/logout
 * Clear the JWT cookie
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT id, username, name, name_set, rank, xp, hp, mp, str, agi, vit, int, sen, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Remove password hash from response, and report the live rank/level
    // computed from XP (the stored rank column is only a registration default)
    const { password_hash: _passwordHash, ...userWithoutPassword } = user;

    res.json({
      user: {
        ...userWithoutPassword,
        rank: calculateRank(user.xp),
        level: calculateLevel(user.xp),
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/set-name
 * Set hunter name once (cannot be changed after)
 */
router.post('/set-name', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    if (name.trim().length > 30) {
      return res.status(400).json({ error: 'Name must be 30 characters or less' });
    }

    // Check if name is already set
    const existing = await pool.query('SELECT name_set FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existing.rows[0].name_set) {
      return res.status(403).json({ error: 'Hunter name has already been set and cannot be changed' });
    }

    // Check if name is already taken by another user
    const nameCheck = await pool.query(
      'SELECT id FROM users WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), userId]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This hunter name is already taken' });
    }

    // Set the name
    await pool.query(
      'UPDATE users SET name = $1, name_set = true, updated_at = NOW() WHERE id = $2',
      [name.trim(), userId]
    );

    await logActivity(userId, 'set_name', name.trim());

    res.json({
      message: 'Hunter name set successfully',
      name: name.trim(),
    });
  } catch (error) {
    console.error('Set name error:', error);
    res.status(500).json({ error: 'Failed to set hunter name' });
  }
});

export default router;
