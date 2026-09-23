import { describe, expect, it } from "vitest";
import { parseSearchQuery, searchMemories, applyFilters, type SearchDoc } from "../search";
import { editDistance, fuzzyScore, normalizeText, placeCoreTokens, tokenMatchScore } from "../text";
import { suggestCategories, suggestFoods, foodUsage } from "../suggest";
import { BIRYANI, DOSA, EMPIRE, MTR, PERSONS, RAVI, TIKKA, memory, review } from "./fixtures";

describe("normalizeText", () => {
  it("lowercases, strips accents, punctuation and extra spaces", () => {
    expect(normalizeText("  Café   Coffee-Day! ")).toBe("cafe coffee day");
    expect(normalizeText("Rock & Roll")).toBe("rock and roll");
    expect(normalizeText("Domino's")).toBe("dominos");
  });
  it("keeps non-latin letters", () => {
    expect(normalizeText("मसाला डोसा")).not.toBe("");
  });
});

describe("fuzzy matching", () => {
  it("computes restricted Damerau-Levenshtein distance", () => {
    expect(editDistance("biryani", "biryani")).toBe(0);
    expect(editDistance("biriyani", "biryani")).toBe(1);
    expect(editDistance("pizaz", "pizza")).toBe(1); // transposition
    expect(editDistance("abc", "xyz", 1)).toBe(2); // early exit reports max + 1
  });
  it("ranks exact > prefix > infix > fuzzy", () => {
    const exact = tokenMatchScore("dosa", "dosa");
    const prefix = tokenMatchScore("pan", "paneer");
    const infix = tokenMatchScore("neer", "paneer");
    const fuzzy = tokenMatchScore("biriyani", "biryani");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(infix);
    expect(infix).toBeGreaterThan(fuzzy);
    expect(fuzzy).toBeGreaterThan(0);
  });
  it("does not fuzz very short tokens", () => {
    expect(tokenMatchScore("mt", "mo")).toBe(0);
  });
  it("requires every query token to match", () => {
    expect(fuzzyScore("paneer biryani", "Paneer Biryani")).toBe(1);
    expect(fuzzyScore("paneer pizza", "Paneer Biryani")).toBe(0);
  });
  it("strips generic place words for place identity", () => {
    expect(placeCoreTokens("The Empire Restaurant")).toEqual(["empire"]);
    expect(placeCoreTokens("Cafe")).toEqual(["cafe"]);
  });
});

describe("parseSearchQuery", () => {
  it("recognises months, years, ratings and costs", () => {
    expect(parseSearchQuery("september").month).toBe(9);
    expect(parseSearchQuery("biryani 2025")).toMatchObject({ terms: ["biryani"], year: 2025 });
    expect(parseSearchQuery("9").minRating).toBe(9);
    expect(parseSearchQuery("8+").minRating).toBe(8);
    expect(parseSearchQuery("under 500").maxCostMajor).toBe(500);
    expect(parseSearchQuery("₹300").maxCostMajor).toBe(300);
    expect(parseSearchQuery("dosa 250").maxCostMajor).toBe(250);
  });
  it("leaves ordinary words as terms", () => {
    expect(parseSearchQuery("Empire Indiranagar").terms).toEqual(["empire", "indiranagar"]);
  });
});

describe("searchMemories", () => {
  const docs: SearchDoc[] = [
    { ...memory({ id: "a", eatenOn: "2026-09-23", ...EMPIRE, foods: [BIRYANI], costMinor: 54000, reviews: [review("p-asha", 9)] }), comments: [] },
    { ...memory({ id: "b", eatenOn: "2026-08-10", ...MTR, foods: [DOSA], costMinor: 20000, reviews: [review("p-asha", 7)] }), comments: ["crispy"] },
    { ...memory({ id: "c", eatenOn: "2025-09-02", ...EMPIRE, foods: [TIKKA], discoveredById: RAVI.id }), comments: [] },
  ];
  const run = (q: string) => searchMemories(docs, parseSearchQuery(q), PERSONS, { minorDigits: 2 }).map((h) => h.memory.id);

  it("finds by food with fuzzy spelling", () => {
    expect(run("biriyani")).toEqual(["a"]);
    expect(run("pan")).toEqual(expect.arrayContaining(["a", "c"]));
  });
  it("finds by place and area", () => {
    expect(run("empire")).toEqual(["a", "c"]);
    expect(run("indiranagar")).toEqual(["a", "c"]);
  });
  it("finds by comment", () => {
    expect(run("crispy")).toEqual(["b"]);
  });
  it("filters by month, rating and cost", () => {
    expect(run("september")).toEqual(["a", "c"]);
    expect(run("9")).toEqual(["a"]);
    expect(run("under 300")).toEqual(["b"]);
  });
  it("finds by discoverer name", () => {
    expect(run("ravi")).toEqual(["c"]);
  });
  it("returns nothing for unmatched text", () => {
    expect(run("sushi")).toEqual([]);
  });
  it("applyFilters honours reviewer, dates and photos", () => {
    expect(applyFilters(docs, { reviewedBy: "p-asha" }).map((d) => d.id)).toEqual(["a", "b"]);
    expect(applyFilters(docs, { from: "2026-01-01" }).map((d) => d.id)).toEqual(["a", "b"]);
    expect(applyFilters(docs, { hasPhotos: true })).toEqual([]);
  });
});

describe("suggestFoods", () => {
  const history = [
    memory({ eatenOn: "2026-09-01", ...EMPIRE, foods: [BIRYANI] }),
    memory({ eatenOn: "2026-09-10", ...EMPIRE, foods: [BIRYANI, TIKKA] }),
    memory({ eatenOn: "2026-09-12", ...MTR, foods: [DOSA] }),
  ];
  const catalog = [BIRYANI, TIKKA, DOSA, { id: "f-pbm", name: "Paneer Butter Masala", category: null }];
  const usage = foodUsage(history);

  it("suggests stored foods that match the prefix", () => {
    const names = suggestFoods("pan", catalog, usage, { today: "2026-09-23" }).map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Paneer Biryani", "Paneer Tikka", "Paneer Butter Masala"]));
    expect(names).not.toContain("Masala Dosa");
  });
  it("boosts foods previously eaten at the chosen place", () => {
    const first = suggestFoods("", catalog, usage, { today: "2026-09-23", placeId: MTR.placeId })[0];
    expect(first.name).toBe("Masala Dosa");
    expect(first.hint).toBe("Had it here before");
  });
  it("never invents foods", () => {
    expect(suggestFoods("sushi", catalog, usage, { today: "2026-09-23" })).toEqual([]);
  });
  it("orders categories by use and keeps defaults", () => {
    expect(suggestCategories("", ["Biryani", "biryani", "Chinese"], ["Pizza"])).toEqual(["Biryani", "Chinese", "Pizza"]);
  });
});
