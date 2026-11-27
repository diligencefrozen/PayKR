import { normalize } from '../models/payment.js';

// Repository contract: async query(kind, category, text) -> read-only catalog entities.
// Bound every public search independently of transport or UI validation.
export class CatalogService {
  constructor(repository) {
    this.repository = repository;
  }
  query(kind, category = 'all', text = '') {
    const query = String(text).normalize('NFKC').trim().slice(0, 100);
    if (query && !normalize(query)) return Promise.resolve([]);
    return this.repository.query(kind, category, query);
  }
  async categories() {
    const rows = await this.query('stores');
    return [...new Set(rows.flatMap((row) => row.categories))];
  }
}
