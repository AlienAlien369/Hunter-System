/**
 * Per-user data isolation tests
 * Verifies quest completions, XP, and stats are scoped to the logged-in user,
 * so a new user always starts from zero.
 * Run with: node --test (requires the server running on localhost:3000)
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";

const BASE_URL = "http://localhost:3000";

async function register(username: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "IsolationPass123!" }),
  });
  assert.strictEqual(res.status, 201, `register ${username} failed`);
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  assert.ok(cookie, "register should set a cookie");
  return cookie;
}

describe("Per-user data isolation", () => {
  const suffix = Date.now();
  let cookieA: string;
  let cookieB: string;

  before(async () => {
    cookieA = await register("iso_user_a_" + suffix);
    cookieB = await register("iso_user_b_" + suffix);
  });

  it("new users start with zero XP and no completions", async () => {
    const stats = await (
      await fetch(`${BASE_URL}/api/stats`, {
        headers: { Cookie: cookieB },
      })
    ).json();
    assert.strictEqual(stats.user.xp, 0);
    assert.strictEqual(parseInt(stats.daily.quests_completed), 0);
    assert.strictEqual(parseInt(stats.weekly.total_quests), 0);
    assert.strictEqual(stats.streak, 0);
  });

  it("completing a quest only awards XP to the completing user", async () => {
    const res = await fetch(`${BASE_URL}/api/quests/DQ-01/complete`, {
      method: "PATCH",
      headers: { Cookie: cookieA },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.action, "completed");
    assert.strictEqual(data.xpGained, 10);

    // User A now has XP and a completion
    const statsA = await (
      await fetch(`${BASE_URL}/api/stats`, {
        headers: { Cookie: cookieA },
      })
    ).json();
    assert.strictEqual(statsA.user.xp, 10);
    assert.strictEqual(parseInt(statsA.daily.quests_completed), 1);

    // User B is untouched
    const statsB = await (
      await fetch(`${BASE_URL}/api/stats`, {
        headers: { Cookie: cookieB },
      })
    ).json();
    assert.strictEqual(statsB.user.xp, 0);
    assert.strictEqual(parseInt(statsB.daily.quests_completed), 0);
  });

  it("quest lists expose completions only for the owning user", async () => {
    const questsA = await (
      await fetch(`${BASE_URL}/api/quests`, {
        headers: { Cookie: cookieA },
      })
    ).json();
    const dqA = questsA.find((q: any) => q.quest_id === "DQ-01");
    assert.strictEqual(dqA.completions.length, 1);

    const questsB = await (
      await fetch(`${BASE_URL}/api/quests`, {
        headers: { Cookie: cookieB },
      })
    ).json();
    const dqB = questsB.find((q: any) => q.quest_id === "DQ-01");
    assert.strictEqual(dqB.completions.length, 0);
  });

  it("uncompleting a quest removes XP only from the owning user", async () => {
    await fetch(`${BASE_URL}/api/quests/DQ-01/complete`, {
      method: "PATCH",
      headers: { Cookie: cookieA },
    });

    const statsA = await (
      await fetch(`${BASE_URL}/api/stats`, {
        headers: { Cookie: cookieA },
      })
    ).json();
    assert.strictEqual(statsA.user.xp, 0);

    const statsB = await (
      await fetch(`${BASE_URL}/api/stats`, {
        headers: { Cookie: cookieB },
      })
    ).json();
    assert.strictEqual(statsB.user.xp, 0);
  });
});
