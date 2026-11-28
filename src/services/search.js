import { inKorea } from './location.js';
import { normalize, placeRecord, brandMatches, paymentFor } from '../models/payment.js';
export const wonjuTerminal = Object.freeze({ lat: 37.34487430629196, lng: 127.93071437137233 });
const areas = {
  명동: ['Myeongdong', '明洞', 'ミョンドン'],
  홍대: ['Hongdae', '弘大', 'ホンデ'],
  서울: ['Seoul', '首尔', '首爾', 'ソウル'],
  인천: ['Incheon', '仁川', 'インチョン'],
  부산: ['Busan', '釜山', 'プサン'],
  제주: ['Jeju', '济州', '濟州', 'チェジュ'],
  강남: ['Gangnam', '江南', 'カンナム'],
  인천국제공항: ['Incheon Airport', '仁川国際空港', '仁川国际机场', '仁川國際機場'],
};
export function keywordFor(input, brands) {
  const key = normalize(input);
  for (const [ko, values] of Object.entries(areas)) if (values.some((a) => normalize(a) === key)) return ko;
  return (
    brands.find((b) => [...Object.values(b.names), ...b.aliases].some((a) => normalize(a) === key))?.names
      .ko || input.trim()
  );
}
export class SearchService {
  constructor(provider, catalog, claims = []) {
    this.claims = claims;
    this.provider = provider;
    this.catalog = catalog;
    this.queue = [];
    this.active = 0;
    this.pending = new Map();
    this.epoch = 0;
  }
  cancel() {
    this.epoch++;
    this.queue.splice(0).forEach((job) => job.resolve(null));
  }
  drain() {
    while (this.active < 4 && this.queue.length) {
      const job = this.queue.shift();
      this.active++;
      job
        .run()
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
  request(keyword, bounds, page) {
    const key = JSON.stringify(['kakao', keyword, bounds, page]);
    if (this.pending.has(key)) return this.pending.get(key);
    // Only requests that actually reached the provider may be shared with a newer search.
    return new Promise((resolve, reject) => {
      const run = () => {
        if (this.pending.has(key)) return this.pending.get(key);
        const task = Promise.resolve()
          .then(() => this.provider.search(keyword, bounds, page))
          .finally(() => this.pending.delete(key));
        this.pending.set(key, task);
        return task;
      };
      this.queue.push({ run, resolve, reject });
      this.drain();
    });
  }
  async search({ input = '', brand = null, category = 'all', bounds = null, offset = 0, page = 1, nearby = false }) {
    this.cancel();
    const epoch = this.epoch;
    const brands = await this.catalog.query('stores', category);
    if (epoch !== this.epoch) return null;
    const groups = new Map();
    for (const brand of brands) {
      const group = brand.categories[0];
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(brand);
    }
    // Cover more categories in the first viewport budget. Later batches retain every brand.
    const ordered = [];
    for (let i = 0; ordered.length < brands.length; i++)
      for (const group of groups.values()) if (group[i]) ordered.push(group[i]);
    const batch = ordered.slice(offset, offset + 12);
    const jobs = input
      ? [{ keyword: keywordFor(input, brands), brand }]
      : batch.map((brand) => ({ keyword: brand.names.ko, brand }));
    const pages = async ({ keyword }) => {
      const rows = [];
      for (let next = page; epoch === this.epoch; next++) {
        let response;
        try { response = await this.request(keyword, bounds, next); }
        catch (error) {
          if (!rows.length) throw error;
          return { rows, partial: true };
        }
        if (!response) break;
        rows.push(...response.rows);
        if (!nearby || !response.more || next >= 3) return { rows, more: response.more };
      }
      return { rows };
    };
    const results = await Promise.allSettled(jobs.map(pages));
    if (epoch !== this.epoch) return null;
    const places = new Map();
    let errors = 0,
      limited = false,
      more = false;
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        errors++;
        return;
      }
      const response = result.value;
      if (!response) return;
      if (response.partial) errors++;
      if (response.more) {
        if (input && page < 3) more = true;
        else limited = true;
      }
      for (const row of response.rows) {
        const place = placeRecord(row);
        if (!place) continue;
        const brand = jobs[i].brand;
        place.icon = brand?.icon || 'logo/marker.png';
        place.claim = paymentFor(
          place.id,
          brand && brandMatches(place.name, brand) ? brand : null,
          this.claims,
        );
        if (!places.has(place.id) || place.claim.status !== 'unknown') places.set(place.id, place);
      }
    });
    return {
      items: [...places.values()],
      errors,
      failed: !places.size && errors === jobs.length && errors > 0,
      limited,
      more: input ? more : offset + batch.length < brands.length,
    };
  }
}

export function acquirePosition(geo) {
  return new Promise((resolve, reject) => {
    if (!geo) {
      reject('location.unsupported');
      return;
    }
    geo.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        if (!inKorea(point)) reject('location.outside');
        else resolve(point);
      },
      (err) => reject({ 1: 'location.denied', 3: 'location.timeout' }[err.code] || 'location.unavailable'),
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    );
  });
}
