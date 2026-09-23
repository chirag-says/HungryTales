import { describe, expect, it } from "vitest";
import { buildCandidates } from "../candidates";
import { findDuplicates } from "../duplicates";
import { clusterPoints, distanceMeters, isValidLatLng } from "../geo";
import { formatMoney, parseMoneyInput, sharesAreValid, spendByPerson, splitEvenly } from "../money";
import { generateStory, listFoods } from "../narrative";
import { matchPlaces, placesNear } from "../places";
import { formatRating, overallOf, summarizeRatings } from "../ratings";
import { recommend, scoreCandidate, totalScore } from "../recommend";
import { seededRandom, spinRoulette, weightedPick, eligibleCandidates } from "../roulette";
import { computeMilestones, computeStats, periodFor } from "../stats";
import { ASHA, BIRYANI, DOSA, EMPIRE, MTR, PERSONS, RAVI, TIKKA, memory, review } from "./fixtures";

describe("ratings", () => {
  it("uses explicit overall, else the mean of aspects", () => {
    expect(overallOf({ taste: 9, quantity: 8, value: 9, overall: null })).toBe(8.7);
    expect(overallOf({ taste: 9, quantity: 8, value: 9, overall: 6 })).toBe(6);
    expect(overallOf({ taste: null, quantity: null, value: null, overall: null })).toBeNull();
  });
  it("keeps both perspectives and reports the gap", () => {
    const s = summarizeRatings([review(ASHA.id, 9), review(RAVI.id, 5)]);
    expect(s.byPerson.get(ASHA.id)).toBe(9);
    expect(s.byPerson.get(RAVI.id)).toBe(5);
    expect(s.combined).toBe(7);
    expect(s.gap).toBe(4);
    expect(formatRating(8.66)).toBe("8.7");
  });
});

describe("money", () => {
  it("parses typed amounts into minor units", () => {
    expect(parseMoneyInput("540", "INR")).toBe(54000);
    expect(parseMoneyInput("₹ 1,299.50", "INR")).toBe(129950);
    expect(parseMoneyInput("", "INR")).toBeNull();
    expect(parseMoneyInput("1.2.3", "INR")).toBeNull();
    expect(parseMoneyInput("500", "JPY")).toBe(500);
  });
  it("splits evenly without losing paise", () => {
    const shares = splitEvenly(54001, ["a", "b"]);
    expect(shares).toEqual({ a: 27001, b: 27000 });
    expect(sharesAreValid(54001, shares)).toBe(true);
    expect(sharesAreValid(54001, { a: 1, b: 1 })).toBe(false);
  });
  it("totals spend per person, treating unsplit bills as shared", () => {
    const totals = spendByPerson(
      [
        { costMinor: 1000, shares: null },
        { costMinor: 600, shares: { a: 600, b: 0 } },
        { costMinor: null, shares: null },
      ],
      ["a", "b"],
    );
    expect(totals).toEqual({ a: 1100, b: 500 });
  });
  it("formats rupees", () => {
    expect(formatMoney(54000, "INR")).toBe("₹540");
    expect(formatMoney(null, "INR")).toBe("");
  });
});

describe("places", () => {
  const known = [
    { id: "1", name: "Empire Restaurant", area: null, latitude: 12.9719, longitude: 77.6412 },
    { id: "2", name: "Meghana Foods", area: null, latitude: null, longitude: null },
    { id: "3", name: "Empire Cafe", area: null, latitude: 13.1, longitude: 77.5 },
  ];
  it("treats identical names as exact", () => {
    expect(matchPlaces("empire  restaurant", null, known)[0]).toMatchObject({ confidence: "exact", place: { id: "1" } });
  });
  it("marks contained names as likely, never exact", () => {
    const res = matchPlaces("Empire Restaurant Bangalore", null, known);
    expect(res.find((r) => r.place.id === "1")?.confidence).toBe("likely");
    expect(res.some((r) => r.confidence === "exact")).toBe(false);
  });
  it("tolerates small misspellings", () => {
    expect(matchPlaces("Meghna Foods", null, known)[0]).toMatchObject({ confidence: "likely", place: { id: "2" } });
  });
  it("ignores unrelated names", () => {
    expect(matchPlaces("Truffles", null, known)).toEqual([]);
  });
  it("finds places near coordinates", () => {
    expect(placesNear({ lat: 12.972, lng: 77.6413 }, known).map((p) => p.place.id)).toEqual(["1"]);
  });
});

describe("geo", () => {
  it("rejects null island and out-of-range values", () => {
    expect(isValidLatLng(0, 0)).toBe(false);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(12.9, 77.6)).toBe(true);
  });
  it("measures distance", () => {
    expect(Math.round(distanceMeters({ lat: 12.9719, lng: 77.6412 }, { lat: 12.9552, lng: 77.5857 }) / 100) / 10).toBeCloseTo(6.3, 0);
  });
  it("clusters close points at low zoom and separates them at high zoom", () => {
    const pts = [
      { lat: 12.9719, lng: 77.6412, item: "a" },
      { lat: 12.972, lng: 77.6413, item: "b" },
      { lat: 12.9552, lng: 77.5857, item: "c" },
    ];
    expect(clusterPoints(pts, 10)).toHaveLength(2);
    expect(clusterPoints(pts, 19)).toHaveLength(3);
  });
});

const TODAY = "2026-09-23";
function history() {
  return [
    memory({ id: "e1", eatenOn: "2026-07-01", ...EMPIRE, category: "Biryani", foods: [BIRYANI], costMinor: 54000,
      reviews: [review(ASHA.id, 9, { wouldEatAgain: "yes", value: 9 }), review(RAVI.id, 9, { wouldEatAgain: "yes", value: 8 })] }),
    memory({ id: "e2", eatenOn: "2026-08-01", ...EMPIRE, category: "Biryani", foods: [BIRYANI, TIKKA], costMinor: 60000,
      reviews: [review(ASHA.id, 9, { wouldEatAgain: "yes" }), review(RAVI.id, 10, { wouldEatAgain: "yes" })] }),
    memory({ id: "m1", eatenOn: "2026-09-21", ...MTR, category: "South Indian", foods: [DOSA], costMinor: 20000,
      reviews: [review(ASHA.id, 7, { wouldEatAgain: "maybe" }), review(RAVI.id, 6)] }),
    memory({ id: "x1", eatenOn: "2026-09-10", placeId: "pl-bad", placeName: "Sad Pizza", category: "Pizza", foods: [{ id: "f-pz", name: "Pizza", category: "Pizza" }],
      reviews: [review(ASHA.id, 3, { wouldEatAgain: "no" }), review(RAVI.id, 2, { wouldEatAgain: "no" })] }),
  ];
}

describe("recommendations", () => {
  it("asks for more history when there is too little", () => {
    expect(recommend([memory({ reviews: [review(ASHA.id, 8)] })], PERSONS, TODAY)).toEqual({ status: "insufficient", reviewedMemories: 1, needed: 3 });
  });
  it("ranks a loved, not-recent place first and explains it from data", () => {
    const res = recommend(history(), PERSONS, TODAY);
    if (res.status !== "ok") throw new Error("expected ok");
    expect(res.items[0].candidate.title).toBe("Empire");
    expect(res.items[0].reasons).toContain("You both rated it 9+ last time.");
    expect(res.items[0].reasons.some((r) => r.startsWith("You haven't been here in"))).toBe(true);
  });
  it("never recommends a place both rejected", () => {
    const res = recommend(history(), PERSONS, TODAY);
    if (res.status !== "ok") throw new Error("expected ok");
    expect(res.items.map((i) => i.candidate.title)).not.toContain("Sad Pizza");
  });
  it("penalises a visit from two days ago on recency", () => {
    const [mtr] = buildCandidates(history(), TODAY).filter((c) => c.title === "MTR");
    expect(scoreCandidate(mtr).recency).toBe(0);
    expect(totalScore(scoreCandidate(mtr))).toBeLessThan(1);
  });
  it("computes candidate facts", () => {
    const empire = buildCandidates(history(), TODAY).find((c) => c.title === "Empire");
    expect(empire).toMatchObject({ visits: 2, lastOn: "2026-08-01", daysSince: 53, avgCostMinor: 57000, eatAgainRatio: 1 });
    expect(empire?.topFood).toMatchObject({ name: "Paneer Tikka", rating: 9.5 });
  });
});

describe("roulette", () => {
  const candidates = buildCandidates(history(), TODAY);
  it("filters by mode", () => {
    expect(eligibleCandidates(candidates, { mode: "love" }).map((c) => c.title)).toEqual(["Empire"]);
    expect(eligibleCandidates(candidates, { mode: "not-recent" }).map((c) => c.title)).toEqual(["Empire"]);
    expect(eligibleCandidates(candidates, { mode: "surprise" }).map((c) => c.title).sort()).toEqual(["Empire", "MTR"]);
  });
  it("applies budget and category filters", () => {
    expect(eligibleCandidates(candidates, { mode: "surprise", maxCostMinor: 30000 }).map((c) => c.title)).toEqual(["MTR"]);
    expect(eligibleCandidates(candidates, { mode: "surprise", category: "south indian" }).map((c) => c.title)).toEqual(["MTR"]);
  });
  it("filters nearby by distance and requires a location", () => {
    expect(eligibleCandidates(candidates, { mode: "nearby", here: { lat: 12.972, lng: 77.641 } }).map((c) => c.title)).toEqual(["Empire"]);
    expect(spinRoulette(candidates, [], { mode: "nearby" }, PERSONS, new Map())).toMatchObject({ status: "empty" });
  });
  it("is deterministic with a seeded RNG and gives reasons", () => {
    const a = spinRoulette(candidates, [], { mode: "surprise" }, PERSONS, new Map(), seededRandom(7));
    const b = spinRoulette(candidates, [], { mode: "surprise" }, PERSONS, new Map(), seededRandom(7));
    expect(a).toEqual(b);
    if (a.status !== "picked") throw new Error("expected pick");
    expect(a.poolSize).toBe(2);
    expect(a.alternates).toHaveLength(1);
  });
  it("draws from the wishlist for 'something new'", () => {
    const wish = { id: "w1", title: "Toit", placeName: null, area: null, category: null, estimatedCostMinor: null, addedByName: "Ravi" };
    const res = spinRoulette(candidates, [wish], { mode: "new" }, PERSONS, new Map(), seededRandom(1));
    expect(res).toMatchObject({ status: "picked", pick: { kind: "wish", reasons: ["On your want-to-try list.", "Ravi added it."] } });
    expect(spinRoulette(candidates, [], { mode: "new" }, PERSONS, new Map())).toMatchObject({ status: "empty" });
  });
  it("weightedPick respects weights", () => {
    expect(weightedPick([0, 1, 0], () => 0.5)).toBe(1);
    expect(weightedPick([1, 1], () => 0.99)).toBe(1);
  });
});

describe("stats", () => {
  it("summarises a period from real data", () => {
    const s = computeStats(history(), PERSONS, periodFor("2026"));
    expect(s.memoryCount).toBe(4);
    expect(s.placesVisited).toBe(3);
    expect(s.newPlaces).toBe(3);
    expect(s.totalSpentMinor).toBe(134000);
    expect(s.avgSpendMinor).toBe(44667);
    expect(s.mostVisitedPlace).toMatchObject({ name: "Empire", count: 2 });
    expect(s.topFood).toMatchObject({ name: "Paneer Biryani", count: 2 });
    expect(s.bestMeal?.memoryId).toBe("e2");
    expect(s.worstMeal?.memoryId).toBe("x1");
    expect(s.mostActiveMonth).toMatchObject({ key: "2026-09", count: 2 });
  });
  it("hides rankings for thin periods", () => {
    const s = computeStats(history(), PERSONS, periodFor("2026-08"));
    expect(s.isThin).toBe(true);
    expect(s.mostVisitedPlace).toBeNull();
    expect(s.bestMeal).toBeNull();
  });
  it("counts discoveries on first visits only", () => {
    const h = [
      memory({ eatenOn: "2026-01-01", ...EMPIRE, discoveredById: RAVI.id }),
      memory({ eatenOn: "2026-02-01", ...EMPIRE, discoveredById: ASHA.id }),
      memory({ eatenOn: "2026-03-01", ...MTR, discoveredById: RAVI.id }),
    ];
    const s = computeStats(h, PERSONS, periodFor("all"));
    expect(s.discoveries).toEqual({ [ASHA.id]: 0, [RAVI.id]: 2 });
    expect(s.topDiscoverer).toEqual({ personId: RAVI.id, count: 2 });
  });
  it("rejects invalid periods", () => {
    expect(() => periodFor("2026-13")).toThrow();
  });
  it("lists only reached milestones", () => {
    const m = computeMilestones(history());
    expect(m.reached.map((r) => r.label)).toEqual(expect.arrayContaining(["Your first memory", "First 10/10", "First return visit: Empire"]));
    expect(m.next).toEqual({ count: 10, remaining: 6 });
  });
});

describe("narrative", () => {
  const base = {
    memoryId: "abc",
    mealTime: null,
    placeName: null,
    foods: [],
    visitNumber: null,
    ratings: [],
    previousCombined: null,
    combined: null,
    discoveredBy: null,
    bothWouldEatAgain: false,
  };
  it("builds a first-visit line only from given facts", () => {
    const s = generateStory({ ...base, mealTime: "late-night", placeName: "Empire", foods: ["Paneer Biryani"], visitNumber: 1,
      ratings: [{ name: "Asha", overall: 9 }, { name: "Ravi", overall: 8 }], discoveredBy: "Ravi" });
    expect(s).toBe("A late-night first visit to Empire for Paneer Biryani. You both rated it highly. Ravi found this one.");
  });
  it("compares with the previous visit", () => {
    const s = generateStory({ ...base, placeName: "Empire", visitNumber: 3, previousCombined: 7, combined: 9 });
    expect(s).toMatch(/Up from 7 last time\./);
  });
  it("reports disagreement as numbers, not feelings", () => {
    const s = generateStory({ ...base, foods: ["Dosa"], ratings: [{ name: "Asha", overall: 9 }, { name: "Ravi", overall: 5 }] });
    expect(s).toBe("Dosa. Asha gave it 9, Ravi 5.");
  });
  it("says nothing when there is nothing to say", () => {
    expect(generateStory(base)).toBe("");
  });
  it("lists foods compactly", () => {
    expect(listFoods(["A", "B", "C", "D"])).toBe("A, B and 2 more");
    expect(listFoods(["A", "B"])).toBe("A and B");
  });
});

describe("duplicates", () => {
  const known = [{ memoryId: "m1", hash: "h1", takenAt: "2026-09-20T20:00:00", width: 4000, height: 3000 }];
  it("flags identical files and same-moment photos", () => {
    const res = findDuplicates(
      [
        { hash: "h1", takenAt: null, width: null, height: null },
        { hash: "h2", takenAt: "2026-09-20T20:00:01", width: 3000, height: 4000 },
        { hash: "h3", takenAt: "2026-09-20T21:00:00", width: 4000, height: 3000 },
        { hash: "h2", takenAt: null, width: null, height: null },
      ],
      known,
    );
    expect(res).toEqual([
      { index: 0, kind: "identical", memoryId: "m1" },
      { index: 1, kind: "same-moment", memoryId: "m1" },
      { index: 3, kind: "identical", memoryId: null },
    ]);
  });
});

describe("money formatting edge cases", () => {
  it("shows two decimals for fractional amounts and none for averages", () => {
    expect(formatMoney(58030, "INR")).toBe("₹580.30");
    expect(formatMoney(58030, "INR", { compact: true })).toBe("₹580");
  });
});
