import assert from "node:assert/strict";
import { describe as d, it as i } from "node:test";
export const describe = d, it = i;
export const expect = (v) => ({ toBe: (x) => assert.strictEqual(v, x), toEqual: (x) => assert.deepStrictEqual(v, x) });
