import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { loadGrayhatState, saveGrayhatState } = require("../scripts/hunter/core/grayhat-state.cjs");
const { rotateQueries } = require("../scripts/hunter/sources/grayhat-query-builder.cjs");

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("GrayHat checkpoint and rotation", () => {
  it("persists bounded metadata without secrets", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "grayhat-state-"));
    directories.push(directory);
    const filePath = path.join(directory, "grayhat.json");
    saveGrayhatState(filePath, {
      queryOffset: 7,
      seenFingerprints: ["file-a", "file-b", "file-a"],
    });

    const loaded = loadGrayhatState(filePath);
    expect(loaded.queryOffset).toBe(7);
    expect(loaded.seenFingerprints).toEqual(["file-a", "file-b"]);
    expect(fs.readFileSync(filePath, "utf8")).not.toContain("access_token");
  });

  it("rotates queries and wraps around deterministically", () => {
    expect(rotateQueries(["a", "b", "c", "d"], 3, 3)).toEqual(["d", "a", "b"]);
  });
});
