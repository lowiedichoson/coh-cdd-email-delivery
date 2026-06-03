import { assertEquals, assertThrows } from "@std/assert";
import {
  buildConfig,
  createPool,
  getCashDeliveryDepositData,
  getCashOnHandData,
  requireEnv,
} from "./main.ts";

/**
 * Snapshot a set of env vars, run a body with overrides applied, then restore
 * the originals — so tests don't leak state into each other or into the real
 * .env values loaded at import time.
 */
function withEnv(overrides: Record<string, string | undefined>, body: () => void) {
  const keys = Object.keys(overrides);
  const original = new Map(keys.map((k) => [k, Deno.env.get(k)]));
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    body();
  } finally {
    for (const k of keys) {
      const prev = original.get(k);
      if (prev === undefined) Deno.env.delete(k);
      else Deno.env.set(k, prev);
    }
  }
}

// --- requireEnv ------------------------------------------------------------

Deno.test("requireEnv returns the value when the variable is set", () => {
  withEnv({ SOME_TEST_KEY: "hello" }, () => {
    assertEquals(requireEnv("SOME_TEST_KEY"), "hello");
  });
});

Deno.test("requireEnv throws a helpful error when the variable is missing", () => {
  withEnv({ SOME_TEST_KEY: undefined }, () => {
    assertThrows(
      () => requireEnv("SOME_TEST_KEY"),
      Error,
      "Missing required environment variable: SOME_TEST_KEY",
    );
  });
});

Deno.test("requireEnv treats an empty string as missing", () => {
  withEnv({ SOME_TEST_KEY: "" }, () => {
    assertThrows(() => requireEnv("SOME_TEST_KEY"), Error);
  });
});

// --- buildConfig -----------------------------------------------------------

const baseEnv = {
  DB_HOST: "testhost",
  DB_PORT: "1234",
  DB_USER: "tester",
  DB_PASSWORD: "secret",
  DB_NAME: "TestDb",
  DB_ENCRYPT: undefined, // default → encryption off
};

Deno.test("buildConfig maps env vars into the mssql config", () => {
  withEnv(baseEnv, () => {
    const config = buildConfig();
    assertEquals(config.server, "testhost");
    assertEquals(config.port, 1234); // coerced to a number
    assertEquals(config.user, "tester");
    assertEquals(config.password, "secret");
    assertEquals(config.database, "TestDb");
    assertEquals(config.connectionTimeout, 10_000);
    assertEquals(config.options?.trustServerCertificate, true);
  });
});

Deno.test("buildConfig leaves encryption off unless DB_ENCRYPT is 'true'", () => {
  withEnv({ ...baseEnv, DB_ENCRYPT: "false" }, () => {
    assertEquals(buildConfig().options?.encrypt, false);
  });
});

Deno.test("buildConfig enables encryption when DB_ENCRYPT is 'true'", () => {
  withEnv({ ...baseEnv, DB_ENCRYPT: "true" }, () => {
    assertEquals(buildConfig().options?.encrypt, true);
  });
});

Deno.test("buildConfig throws if a required DB var is missing", () => {
  withEnv({ ...baseEnv, DB_HOST: undefined }, () => {
    assertThrows(() => buildConfig(), Error, "DB_HOST");
  });
});

// --- Integration tests (need a live DB + real stored-proc names) -----------
// Enabled once the TODO stored-proc names in main.ts are filled in. Run with
// `deno test --allow-net --allow-env --allow-read --allow-sys` and flip ignore off.

Deno.test({
  name: "getCashOnHandData executes the COH stored procedure",
  ignore: true,
  fn: async () => {
    const pool = await createPool();
    try {
      await getCashOnHandData(pool);
    } finally {
      await pool.close();
    }
  },
});

Deno.test({
  name: "getCashDeliveryDepositData executes the CDD stored procedure",
  ignore: true,
  fn: async () => {
    const pool = await createPool();
    try {
      await getCashDeliveryDepositData(pool);
    } finally {
      await pool.close();
    }
  },
});
