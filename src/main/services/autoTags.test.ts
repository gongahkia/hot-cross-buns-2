import { describe, expect, it } from "vitest";
import type { AutoTagRule } from "@shared/ipc/contracts";
import { applyAutoTagRules } from "./autoTags";

const now = "2026-06-06T00:00:00.000Z";

function rule(patch: Partial<AutoTagRule> = {}): AutoTagRule {
  return {
    id: "rule-1",
    name: "Coding",
    enabled: true,
    targetKinds: ["task", "event", "note"],
    matchField: "title",
    matchType: "prefix",
    pattern: "CODING",
    tags: ["coding"],
    stripMatchedPrefix: false,
    eventColorId: null,
    overrideExistingEventColor: false,
    createdAt: now,
    updatedAt: now,
    ...patch
  };
}

describe("auto tags", () => {
  it("adds tags, strips prefixes, and preserves explicit tag casing", () => {
    expect(applyAutoTagRules([rule({ stripMatchedPrefix: true })], {
      kind: "task",
      title: "CODING: Ship auto tags",
      body: "",
      explicitTags: ["Launch"],
      existingTags: ["launch"]
    })).toEqual({
      title: "Ship auto tags",
      body: "",
      tags: ["launch", "coding"],
      eventColorId: undefined
    });
  });

  it("maps event color only when no explicit or existing color is present unless overridden", () => {
    const colorRule = rule({ eventColorId: "5" });

    expect(applyAutoTagRules([colorRule], {
      kind: "event",
      title: "CODING: Review",
      body: "",
      requestedEventColorId: null,
      existingEventColorId: null
    }).eventColorId).toBe("5");

    expect(applyAutoTagRules([colorRule], {
      kind: "event",
      title: "CODING: Review",
      body: "",
      requestedEventColorId: "3",
      existingEventColorId: null
    }).eventColorId).toBe("3");

    expect(applyAutoTagRules([rule({ eventColorId: "5", overrideExistingEventColor: true })], {
      kind: "event",
      title: "CODING: Review",
      body: "",
      requestedEventColorId: "3",
      existingEventColorId: "2"
    }).eventColorId).toBe("5");
  });

  it("skips birthdays", () => {
    expect(applyAutoTagRules([rule({ eventColorId: "5" })], {
      kind: "event",
      title: "CODING: Birthday",
      body: "",
      hcbKind: "birthday",
      explicitTags: ["manual"],
      requestedEventColorId: null
    })).toEqual({
      title: "CODING: Birthday",
      body: "",
      tags: ["manual"],
      eventColorId: null
    });
  });
});
