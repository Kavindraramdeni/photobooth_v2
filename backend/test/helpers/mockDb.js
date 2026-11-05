/**
 * In-memory stateful database mock for automated integration tests
 * Emulates Supabase query builder with genuine state storage
 */

const state = {
  events: [],
  photos: [],
  event_styles: [],
  event_frames: [],
  event_backgrounds: [],
  photo_templates: [],
  leads: [],
  analytics: [],
  event_staff: [],
};

function resetDb() {
  state.events = [];
  state.photos = [];
  state.event_styles = [];
  state.event_frames = [];
  state.event_backgrounds = [];
  state.photo_templates = [];
  state.leads = [];
  state.analytics = [];
  state.event_staff = [];
}

function getTable(name) {
  if (!state[name]) state[name] = [];
  return state[name];
}

class QueryBuilder {
  constructor(table) {
    this.tableName = table;
    this.records = getTable(table);
    this.filters = [];
    this.selectedFields = null;
    this.limitCount = null;
    this.offsetCount = null;
    this.orderConfig = null;
    this.operation = 'select';
    this.insertData = null;
    this.updateData = null;
  }

  select(fields = '*', options = {}) {
    this.selectedFields = fields;
    this.selectOptions = options;
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data) {
    return this.insert(data);
  }

  update(data) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field, value) {
    this.filters.push((item) => {
      if (field.includes('->>')) {
        const [col, key] = field.split('->>');
        return item[col]?.[key] === value;
      }
      return item[field] === value;
    });
    return this;
  }

  neq(field, value) {
    this.filters.push((item) => item[field] !== value);
    return this;
  }

  or(conditionStr) {
    // Basic parser for or clauses like 'is_hidden.eq.false,is_hidden.is.null' or 'id.eq.X,metadata->>clientPhotoId.eq.X'
    const parts = conditionStr.split(',');
    this.filters.push((item) => {
      return parts.some((p) => {
        if (p.includes('.eq.')) {
          const [field, val] = p.split('.eq.');
          if (field.includes('->>')) {
            const [col, key] = field.split('->>');
            return String(item[col]?.[key]) === String(val);
          }
          return String(item[field]) === String(val);
        }
        if (p.includes('.is.null')) {
          const field = p.split('.is.null')[0];
          return item[field] === null || item[field] === undefined;
        }
        return false;
      });
    });
    return this;
  }

  contains(field, obj) {
    this.filters.push((item) => {
      const target = item[field];
      if (!target || typeof target !== 'object') return false;
      return Object.entries(obj).every(([k, v]) => target[k] === v);
    });
    return this;
  }

  in(field, values) {
    this.filters.push((item) => values.includes(item[field]));
    return this;
  }

  gte(field, value) {
    this.filters.push((item) => item[field] >= value);
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orderConfig = { field, ascending };
    return this;
  }

  range(from, to) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  async _execute() {
    const table = getTable(this.tableName);

    if (this.operation === 'insert') {
      const created = this.insertData.map((d) => ({
        id: d.id || require('crypto').randomUUID(),
        created_at: new Date().toISOString(),
        ...d,
      }));
      table.push(...created);
      return { data: this.insertData.length === 1 ? created[0] : created, error: null, count: created.length };
    }

    if (this.operation === 'update') {
      let matched = table.filter((item) => this.filters.every((f) => f(item)));
      matched.forEach((item) => {
        Object.assign(item, this.updateData);
      });
      return { data: matched[0] || null, error: null, count: matched.length };
    }

    if (this.operation === 'delete') {
      const initialCount = table.length;
      const remaining = table.filter((item) => !this.filters.every((f) => f(item)));
      state[this.tableName] = remaining;
      const count = initialCount - remaining.length;
      return { data: null, error: null, count };
    }

    // SELECT
    let result = table.filter((item) => this.filters.every((f) => f(item)));

    // Join simulation for events relation
    if (this.selectedFields && (this.selectedFields.includes('events(') || this.selectedFields.includes('events!inner('))) {
      result = result.map((item) => {
        const eventId = item.event_id;
        const event = state.events.find((e) => e.id === eventId);
        return {
          ...item,
          events: event ? { id: event.id, name: event.name, slug: event.slug, branding: event.branding, settings: event.settings, owner_id: event.owner_id } : null,
        };
      });
    }

    if (this.orderConfig) {
      result.sort((a, b) => {
        const valA = a[this.orderConfig.field];
        const valB = b[this.orderConfig.field];
        if (valA < valB) return this.orderConfig.ascending ? -1 : 1;
        if (valA > valB) return this.orderConfig.ascending ? 1 : -1;
        return 0;
      });
    }

    const count = result.length;

    if (this.offsetCount !== null || this.limitCount !== null) {
      const from = this.offsetCount || 0;
      const to = this.limitCount ? from + this.limitCount : result.length;
      result = result.slice(from, to);
    }

    return { data: result, error: null, count };
  }

  async single() {
    const res = await this._execute();
    const data = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!data) return { data: null, error: new Error('Record not found') };
    return { data, error: null };
  }

  async maybeSingle() {
    const res = await this._execute();
    const data = Array.isArray(res.data) ? (res.data[0] || null) : res.data;
    return { data, error: null };
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  catch(reject) {
    return this._execute().catch(reject);
  }

  finally(callback) {
    return this._execute().finally(callback);
  }
}

function createMockSupabase() {
  return {
    from(table) {
      return new QueryBuilder(table);
    },
    auth: {
      async getUser(token) {
        if (!token) return { data: { user: null }, error: new Error('No token') };
        if (token.startsWith('owner-token-')) {
          const userId = token.replace('owner-token-', '');
          return { data: { user: { id: userId, email: `${userId}@example.com`, role: 'user' } }, error: null };
        }
        if (token === 'valid-user-token') {
          return { data: { user: { id: 'user-123', email: 'user@example.com', role: 'user' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
  };
}

module.exports = {
  state,
  resetDb,
  getTable,
  createMockSupabase,
};
