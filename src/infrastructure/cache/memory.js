export class MemoryCache {
  #records = new Map();
  constructor(limit, ttl, clock = Date.now) {
    Object.assign(this, { limit, ttl, clock });
  }
  get(key) {
    const record = this.#records.get(key);
    if (!record) return;
    this.#records.delete(key);
    if (record.until <= this.clock()) return;
    this.#records.set(key, record);
    return record.value;
  }
  set(key, value) {
    this.#records.delete(key);
    this.#records.set(key, { value, until: this.clock() + this.ttl });
    if (this.#records.size > this.limit) this.#records.delete(this.#records.keys().next().value);
  }
  clear() {
    this.#records.clear();
  }
  get size() {
    return this.#records.size;
  }
}
