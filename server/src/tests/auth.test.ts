/**
 * Simple auth endpoint tests
 * Run with: node --test src/auth.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

describe('Authentication API', () => {
  let authCookie;

  it('should register a new user', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_' + Date.now(), password: 'TestPass123!' }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.message);
    assert.ok(data.user);
    assert.ok(data.user.id);
  });

  it('should return 400 for missing fields', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('should return 400 for short username', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ab', password: 'test' }),
    });
    assert.strictEqual(res.status, 400);
  });

  it('should return 400 for short password', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser123', password: '123' }),
    });
    assert.strictEqual(res.status, 400);
  });

  it('should return 409 for duplicate username', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'duplicate_user', password: 'TestPass123!' }),
    });
    assert.strictEqual(res.status, 201);

    // Try again with same username
    const res2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'duplicate_user', password: 'TestPass123!' }),
    });
    assert.strictEqual(res2.status, 409);
  });

  it('should login with valid credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alien', password: 'Alien@123' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.message);
    assert.ok(data.user);
    assert.strictEqual(data.user.username, 'alien');
  });

  it('should return 401 for invalid credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alien', password: 'wrongpassword' }),
    });
    assert.strictEqual(res.status, 401);
  });

  it('should return 401 for non-existent user', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'SomePass123!' }),
    });
    assert.strictEqual(res.status, 401);
  });

  it('should get current user with valid token', async () => {
    // First login to get cookie
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alien', password: 'Alien@123' }),
    });
    const cookies = loginRes.headers.get('set-cookie');
    assert.ok(cookies);

    // Get user info using cookie
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': cookies },
    });
    assert.strictEqual(meRes.status, 200);
    const data = await meRes.json();
    assert.ok(data.user);
    assert.strictEqual(data.user.username, 'alien');
  });

  it('should return 401 for /me without token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    assert.strictEqual(res.status, 401);
  });

  it('should logout', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.message);
  });
});
