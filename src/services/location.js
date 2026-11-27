// Use a generalized coastline only to choose the Korean search experience.
import { coast } from '../data/korea-coast.js';
export function inKorea({ lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32.9 || lat > 38.8 || lng < 124.4 || lng > 132)
    return false;
  return coast.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j],
        [bx, by] = ring[i];
      if (ay > lat !== by > lat && lng < ((bx - ax) * (lat - ay)) / (by - ay) + ax) inside = !inside;
      // Allow coastal terminals and the generalization error of the 1:50m map.
      const dx = bx - ax,
        dy = by - ay;
      const along = Math.max(0, Math.min(1, ((lng - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(lng - ax - along * dx, lat - ay - along * dy) < 0.045) return true;
    }
    return inside;
  });
}
