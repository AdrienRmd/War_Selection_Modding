import assert from "node:assert/strict";

// Run against the local dev server only (npm run dev). The account is created
// through the real /api/auth/signup endpoint (falling back to /api/auth/signin
// when it already exists) and every scenario runs with the issued session
// cookie. Never point this script at a public host.
const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");
const password = "qa-local-password-123";
const player = {
  email: "role-a@test.local",
  displayName: "QA Role A",
  cookie: null,
};
const id = "67d2c81d-1178-4df3-8f7a-645d390b3ebd";
const report = [];

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  report.push(name);
  console.log("PASS", name);
}

async function call(path, { method = "GET", body, headers = {}, cookie = player.cookie } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== "GET" ? { Origin: origin, "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* Non-JSON response. */
  }
  return { status: response.status, data };
}

// signup returns 201 for a new account; 409 means an earlier run created it,
// so sign in through the real endpoint instead. The session cookie from the
// Set-Cookie header drives every authenticated request below.
async function establishSession(account) {
  const payload = JSON.stringify({
    email: account.email,
    password,
    displayName: account.displayName,
  });
  let res = await fetch(origin + "/api/auth/signup", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: payload,
  });
  if (res.status === 409) {
    res = await fetch(origin + "/api/auth/signin", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password }),
    });
  }
  assert.ok(res.status === 200 || res.status === 201, "account signup/signin status " + res.status);
  const setCookie = res.headers.get("set-cookie");
  assert.ok(setCookie && setCookie.startsWith("atlas_session="), "session cookie issued");
  account.cookie = setCookie.split(";")[0];
}

let failure;
try {
  await establishSession(player);
  check("real account session cookie stored", player.cookie?.startsWith("atlas_session="), true);

  const me = await call("/api/atlas/me");
  check(
    "authenticated non-admin identity",
    { signedIn: me.data?.signedIn, admin: me.data?.admin },
    { signedIn: true, admin: false },
  );

  // Forged upstream headers must stay anonymous now that identity comes from
  // the session database: a header-only caller without any session cookie is
  // not signed in, even when carrying a plausible user id or admin email.
  const spoofed = await call("/api/atlas/me", {
    cookie: null,
    headers: {
      "oai-authenticated-user-id": "qa_other_player",
      "oai-authenticated-user-email": "qa-player@example.invalid",
    },
  });
  check("forged identity headers stay anonymous", spoofed.data?.signedIn, false);

  check(
    "non-admin cannot access admin scope",
    (await call("/api/atlas/submissions?scope=admin")).status,
    403,
  );
  check(
    "non-admin cannot review records",
    (
      await call("/api/atlas/review/" + id, {
        method: "PATCH",
        body: {
          status: "approved",
          feedback: "不应允许此账号操作",
          revision: 0,
          checks: ["ownership", "files", "gameplay", "description"],
        },
      })
    ).status,
    403,
  );
  check(
    "non-owner cannot withdraw foreign record",
    (await call("/api/atlas/withdraw/" + id, { method: "POST" })).status,
    404,
  );
  check(
    "non-owner cannot download foreign record",
    (await call("/api/atlas/files/" + id)).status,
    404,
  );
  const list = (await call("/api/atlas/submissions")).data;
  check(
    "personal list excludes foreign record",
    list.items.some((x) => x.id === id),
    false,
  );
} catch (error) {
  failure = error;
} finally {
  if (player.cookie) {
    try {
      const res = await fetch(origin + "/api/auth/signout", {
        method: "POST",
        headers: { Origin: origin, Cookie: player.cookie },
      });
      assert.equal(res.status, 200, "signout status");
      player.cookie = null;
      console.log("PASS session signed out and cleared locally");
    } catch (error) {
      failure = failure ? new AggregateError([failure, error], "Test and cleanup failed") : error;
    }
  }
  console.log(
    JSON.stringify(
      {
        passed: report.length,
        result: failure ? "FAILED" : "PASSED",
        scope: origin + " — real session-cookie account via /api/auth, local only",
        account: player.email,
        cleanup: ["Session destroyed via /api/auth/signout; no record was created or modified."],
      },
      null,
      2,
    ),
  );
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
