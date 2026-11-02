import { describe, expect, it } from "vitest";
import {
  PEER_DISTANCE_A_LIMIT,
  PEER_DISTANCE_MAX,
  PEER_DISTANCE_MIN,
  clampPeerDistance,
  peerGradeScope,
} from "@/lib/peerDistance";

describe("peerDistance — suwak dystansu par", () => {
  it("granica A leży między minimum a maksimum suwaka", () => {
    expect(PEER_DISTANCE_MIN).toBeLessThan(PEER_DISTANCE_A_LIMIT);
    expect(PEER_DISTANCE_A_LIMIT).toBeLessThan(PEER_DISTANCE_MAX);
  });

  it.each([
    [8.51, 8.51],
    [8.5, 8.51],
    [12.345, 12.36],
    [0, PEER_DISTANCE_MIN],
    [-3, PEER_DISTANCE_MIN],
    [40, PEER_DISTANCE_MAX],
    [Number.NaN, PEER_DISTANCE_A_LIMIT],
    [Number.POSITIVE_INFINITY, PEER_DISTANCE_A_LIMIT],
  ])("clampPeerDistance(%s) = %s", (input, expected) => {
    expect(clampPeerDistance(input)).toBe(expected);
  });

  it("granica A leży na siatce kroku suwaka", () => {
    expect(clampPeerDistance(PEER_DISTANCE_A_LIMIT)).toBe(PEER_DISTANCE_A_LIMIT);
    expect(clampPeerDistance(PEER_DISTANCE_MAX)).toBe(PEER_DISTANCE_MAX);
  });

  it("do granicy A włącza tylko pary A, powyżej także pary B", () => {
    expect(peerGradeScope(PEER_DISTANCE_MIN)).toBe("A");
    expect(peerGradeScope(PEER_DISTANCE_A_LIMIT)).toBe("A");
    expect(peerGradeScope(10.06)).toBe("AB");
    expect(peerGradeScope(PEER_DISTANCE_MAX)).toBe("AB");
  });
});
