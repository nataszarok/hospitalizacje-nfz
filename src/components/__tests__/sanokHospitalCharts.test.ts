import { describe, expect, it } from "vitest";
import { spreadLabels } from "@/components/sanok/SanokHospitalCharts";

describe("spreadLabels", () => {
  it("rozsuwa etykiety zbyt blisko siebie i zachowuje kolejność wejścia", () => {
    expect(spreadLabels([10, 11, 30], 5)).toEqual([10, 15, 30]);
    expect(spreadLabels([30, 10, 11], 5)).toEqual([30, 10, 15]);
  });

  it("nie zmienia etykiet, które się nie nakładają", () => {
    expect(spreadLabels([0, 20, 40], 5)).toEqual([0, 20, 40]);
  });
});
