import { describe, it, expect } from "vitest";
import { fetchAllRows } from "./fetch-all";

describe("fetchAllRows", () => {
  it("returns every row when the table has more than 1000 rows", async () => {
    const table = Array.from({ length: 1164 }, (_, i) => ({ id: i }));
    const { data, error } = await fetchAllRows(async (from, to) => ({
      data: table.slice(from, Math.min(to + 1, from + 1000)),
      error: null,
    }));
    expect(error).toBeNull();
    expect(data).toHaveLength(1164);
    expect(data[1163].id).toBe(1163);
  });
});
