import { describe, it, expect } from "vitest";
import { liveAccounts, computeMetaStats } from "./meta-account-stats";

const now = "2026-11-02T20:00:00Z";
const old = "2026-10-30T20:00:00Z";

describe("meta account stats", () => {
  it("excludes archived accounts from the panel numbers", () => {
    const live = liveAccounts([
      { id: "a", status: "active", last_synced_at: now },
      { id: "b", status: "blocked", last_synced_at: now, archived_at: now },
    ]);
    expect(live.map((a) => a.id)).toEqual(["a"]);
  });

  it("excludes accounts not returned in the last sync and permission errors", () => {
    const live = liveAccounts([
      { id: "a", status: "active", last_synced_at: now },
      { id: "b", status: "active", last_synced_at: old },
      { id: "c", status: "active", last_synced_at: now, last_sync_error_code: 200 },
    ]);
    expect(live.map((a) => a.id)).toEqual(["a"]);
  });

  it("active + blocked = total and assigned + unassigned = total, counting each account once", () => {
    const live = [
      { id: "a", status: "active" },
      { id: "b", status: "blocked" },
      { id: "c", status: "blocked" },
    ];
    const s = computeMetaStats(live, [
      { ad_account_id: "a", client_id: "x" },
      { ad_account_id: "a", client_id: "y" },
      { ad_account_id: "zzz-archived", client_id: "x" },
    ]);
    expect(s).toEqual({ total: 3, active: 1, blocked: 2, assigned: 1, unassigned: 2 });
  });
});
