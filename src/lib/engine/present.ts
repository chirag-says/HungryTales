import { mealTimeOf } from "./dates";
import { listFoods } from "./narrative";

/** Headline for a memory: the food if known, else the place, else the meal time. */
export function memoryTitle(m: { foods: { name: string }[]; placeName: string | null; category: string | null; eatenAt: string | null }): string {
  if (m.foods.length) return listFoods(m.foods.map((f) => f.name));
  if (m.placeName) return m.placeName;
  if (m.category) return m.category;
  const time = mealTimeOf(m.eatenAt);
  if (time) return time === "late-night" ? "Late-night bite" : `${time.charAt(0).toUpperCase()}${time.slice(1)}`;
  return "A meal";
}

/** Secondary line: place (when the title is the food) and area. */
export function memorySubtitle(m: { foods: { name: string }[]; placeName: string | null; area: string | null; locationLabel: string | null }): string | null {
  const where = m.foods.length ? m.placeName : null;
  const area = m.area ?? m.locationLabel;
  const parts = [where, area && area !== where ? area : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
