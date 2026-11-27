import { MemoryCache } from '../infrastructure/cache/memory.js';
import { normalize, legacyClaim } from '../models/payment.js';

import { VERSION } from '../data/catalog-version.js';
const DAY = 86400000;
function valid(records, kind) {
  return (
    Array.isArray(records) &&
    records.length > 0 &&
    records.every(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        r.id.startsWith(kind === 'stores' ? 'store-' : 'online-') &&
        typeof r.names?.ko === 'string' &&
        Array.isArray(r.aliases) &&
        Array.isArray(r.categories) &&
        /^(logo|logo_online)\/[\w-]+\.png$/.test(r.icon),
    ) &&
    new Set(records.map((r) => r.id)).size === records.length
  );
}
function indexRecords(rows) {
  const groups = { all: [] };
  for (const row of rows) {
    groups.all.push(row.id);
    for (const category of row.categories) (groups[category] ||= []).push(row.id);
  }
  return groups;
}
export class CatalogRepository {
  constructor(source, storage, { clock = Date.now, notify = () => {} } = {}) {
    Object.assign(this, { source, storage, clock, notify });
    this.entities = new MemoryCache(2, 300000, clock);
    this.queries = new MemoryCache(64, 120000, clock);
    this.pending = new Map();
    this.generation = 0;
    this.metrics = { l1: 0, l2: 0, source: 0, merged: 0, query: 0 };
  }
  async snapshot(kind) {
    if (!['stores', 'online'].includes(kind)) throw new Error('Unknown catalog');
    const hit = this.entities.get(kind);
    if (hit && hit.expires > this.clock()) {
      this.metrics.l1++;
      return hit;
    }
    if (this.pending.has(kind)) {
      this.metrics.merged++;
      return this.pending.get(kind);
    }
    const epoch = this.generation;
    const task = this.load(kind, epoch);
    this.pending.set(kind, task);
    try {
      return await task;
    } finally {
      if (this.pending.get(kind) === task) this.pending.delete(kind);
    }
  }
  async load(kind, epoch) {
    let record, storageEpoch;
    try {
      if (this.storage?.readSnapshot) {
        const snapshot = await this.storage.readSnapshot(kind);
        record = snapshot.record;
        storageEpoch = snapshot.epoch;
      } else record = await this.storage?.read(kind);
    } catch {
      /* Restricted storage. */
    }
    if (
      record?.version === VERSION &&
      record.expires > this.clock() &&
      valid(record.rows, kind) &&
      JSON.stringify(indexRecords(record.rows)) === JSON.stringify(record.groups)
    ) {
      this.metrics.l2++;
    } else {
      this.metrics.source++;
      const rows = await this.source(kind);
      if (!valid(rows, kind)) throw new Error('Invalid catalog');
      record = { version: VERSION, expires: this.clock() + DAY, rows, groups: indexRecords(rows) };
      if (epoch === this.generation)
        try {
          await this.storage?.write(kind, record, storageEpoch);
        } catch {
          /* Quota or storage denial. */
        }
    }
    const entities = new Map(
      record.rows.map((row) => [
        row.id,
        { ...row, claim: legacyClaim(row.id, kind === 'online' ? 'online' : 'in_store') },
      ]),
    );
    const names = new Map(
      record.rows.map((row) => [row.id, [...Object.values(row.names), ...row.aliases].map(normalize)]),
    );
    const snapshot = { entities, names, groups: record.groups, expires: record.expires };
    if (epoch === this.generation) this.entities.set(kind, snapshot);
    return snapshot;
  }
  async query(kind, category = 'all', input = '') {
    const generation = this.generation;
    const snapshot = await this.snapshot(kind);
    const query = normalize(input);
    const key = JSON.stringify([VERSION, kind, category, query]);
    let ids = this.queries.get(key);
    if (ids?.snapshot === snapshot) {
      this.metrics.query++;
      return ids.items.map((id) => snapshot.entities.get(id));
    }
    const items = (Object.hasOwn(snapshot.groups, category) ? snapshot.groups[category] : []).filter((id) =>
      snapshot.names.get(id).some((n) => n.includes(query)),
    );
    if (generation === this.generation) this.queries.set(key, { snapshot, items });
    return items.map((id) => snapshot.entities.get(id));
  }
  invalidate() {
    this.generation++;
    this.pending.clear();
    this.entities.clear();
    this.queries.clear();
  }
  async clear() {
    this.invalidate();
    try {
      await this.storage?.clear();
    } finally {
      this.invalidate();
      this.notify();
    }
  }
}
