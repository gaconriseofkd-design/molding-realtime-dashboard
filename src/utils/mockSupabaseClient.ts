// Mock Supabase Client đọc dữ liệu từ window.__JUNE_DATA__ được inject sẵn vào HTML
// Tuyệt đối không gọi ra mạng, không kết nối Supabase thật.

// Đọc dữ liệu từ global window (được inject bởi setup_demo_dist.js vào index.html)
const win = typeof window !== 'undefined' ? (window as any) : {};
const JUNE = win.__JUNE_DATA__ || {
  machines: [], runningMolds: [], moldMasters: [], defaultShelves: [], scanLogs: [], scanUsers: []
};

// Khởi tạo in-memory store từ window.__JUNE_DATA__
const STORAGE_PREFIX = 'molding_june_demo_';

function getInitialTableData(table: string): any[] {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_PREFIX + table);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
  }
  switch (table) {
    case 'machines':       return JSON.parse(JSON.stringify(JUNE.machines || []));
    case 'running_molds':  return JSON.parse(JSON.stringify(JUNE.runningMolds || []));
    case 'mold_master':    return JSON.parse(JSON.stringify(JUNE.moldMasters || []));
    case 'default_shelves':return JSON.parse(JSON.stringify(JUNE.defaultShelves || []));
    case 'scan_logs':      return JSON.parse(JSON.stringify(JUNE.scanLogs || []));
    case 'scan_users':     return JSON.parse(JSON.stringify(JUNE.scanUsers || []));
    default: return [];
  }
}

function saveTableData(table: string, data: any[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage full, falling back to memory only', e);
    }
  }
}

// In-memory store
const store: Record<string, any[]> = {
  machines: getInitialTableData('machines'),
  running_molds: getInitialTableData('running_molds'),
  mold_master: getInitialTableData('mold_master'),
  default_shelves: getInitialTableData('default_shelves'),
  scan_logs: getInitialTableData('scan_logs'),
  scan_users: getInitialTableData('scan_users'),
  efficiency_log: []
};

// Event listeners for realtime imitation
const realtimeListeners: Array<(event: { table: string; eventType: string; new: any; old: any }) => void> = [];

function notifyRealtime(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newItem: any, oldItem: any) {
  saveTableData(table, store[table] || []);
  realtimeListeners.forEach(listener => {
    try {
      listener({ table, eventType, new: newItem, old: oldItem });
    } catch (err) {
      console.error('Realtime mock listener error:', err);
    }
  });
}

// Hàm khôi phục lại dữ liệu gốc tháng 6 bất kỳ lúc nào
export function resetJuneSnapshotData() {
  if (typeof window !== 'undefined') {
    Object.keys(store).forEach(tbl => localStorage.removeItem(STORAGE_PREFIX + tbl));
  }
  store.machines = JSON.parse(JSON.stringify(JUNE_MACHINES));
  store.running_molds = JSON.parse(JSON.stringify(JUNE_RUNNING_MOLDS));
  store.mold_master = JSON.parse(JSON.stringify(JUNE_MOLD_MASTERS));
  store.default_shelves = JSON.parse(JSON.stringify(JUNE_DEFAULT_SHELVES));
  store.scan_logs = JSON.parse(JSON.stringify(JUNE_SCAN_LOGS));
  store.scan_users = JSON.parse(JSON.stringify(JUNE_SCAN_USERS));
  notifyRealtime('running_molds', 'UPDATE', {}, {});
  notifyRealtime('machines', 'UPDATE', {}, {});
}

// Query Builder Mock chuẩn spec Promises/A+ (không dùng async then)
class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderField?: string;
  private isAscending: boolean = true;
  private limitCount?: number;
  private rangeFrom?: number;
  private rangeTo?: number;
  private selectCols?: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    if (!store[this.tableName]) {
      store[this.tableName] = [];
    }
  }

  select(cols: string = '*') {
    this.selectCols = cols;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(item => item[column] == value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push(item => item[column] != value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push(item => Array.isArray(values) && values.includes(item[column]));
    return this;
  }

  like(column: string, pattern: string) {
    const regexPattern = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$';
    const regex = new RegExp(regexPattern, 'i');
    this.filters.push(item => regex.test(String(item[column] || '')));
    return this;
  }

  ilike(column: string, pattern: string) {
    return this.like(column, pattern);
  }

  match(criteria: Record<string, any>) {
    Object.keys(criteria).forEach(k => {
      this.filters.push(item => item[k] == criteria[k]);
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.isAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  private executeQuery(): any[] {
    let result = [...(store[this.tableName] || [])];
    for (const f of this.filters) {
      result = result.filter(f);
    }
    if (this.orderField) {
      const field = this.orderField;
      const asc = this.isAscending;
      result.sort((a, b) => {
        if (a[field] === undefined || b[field] === undefined) return 0;
        if (a[field] < b[field]) return asc ? -1 : 1;
        if (a[field] > b[field]) return asc ? 1 : -1;
        return 0;
      });
    }

    if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
      result = result.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitCount !== undefined) {
      result = result.slice(0, this.limitCount);
    }

    return JSON.parse(JSON.stringify(result));
  }

  // Chuẩn Promises/A+: hàm then nhận resolve và reject, trả về Promise thực thụ
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const data = this.executeQuery();
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }

  single(): Promise<{ data: any; error: any }> {
    const data = this.executeQuery();
    return Promise.resolve({
      data: data[0] || null,
      error: data.length === 0 ? { message: 'Not found' } : null
    });
  }

  maybeSingle(): Promise<{ data: any; error: any }> {
    const data = this.executeQuery();
    return Promise.resolve({
      data: data[0] || null,
      error: null
    });
  }

  insert(recordOrRecords: any | any[]): Promise<{ data: any; error: any }> {
    const table = this.tableName;
    const items = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
    const newItems: any[] = [];

    items.forEach((item, idx) => {
      const cloned = { ...item };
      if (!cloned.id) {
        cloned.id = Date.now() + idx;
      }
      if (!cloned.uuid) {
        cloned.uuid = 'uuid-mock-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      }
      if (!cloned.created_at) {
        cloned.created_at = new Date().toISOString();
      }
      store[table].push(cloned);
      newItems.push(cloned);
      notifyRealtime(table, 'INSERT', cloned, null);
    });

    return Promise.resolve({ data: newItems, error: null });
  }

  update(updateData: any): Promise<{ data: any; error: any }> {
    const table = this.tableName;
    const targetItems = store[table].filter(item => this.filters.every(f => f(item)));
    targetItems.forEach(item => {
      const oldItem = { ...item };
      Object.assign(item, updateData, { updated_at: new Date().toISOString() });
      notifyRealtime(table, 'UPDATE', item, oldItem);
    });
    return Promise.resolve({ data: targetItems, error: null });
  }

  delete(): Promise<{ data: any; error: any }> {
    const table = this.tableName;
    const removed: any[] = [];
    store[table] = store[table].filter(item => {
      const match = this.filters.every(f => f(item));
      if (match) removed.push(item);
      return !match;
    });
    removed.forEach(item => notifyRealtime(table, 'DELETE', null, item));
    return Promise.resolve({ data: removed, error: null });
  }

  upsert(recordOrRecords: any | any[], options?: { onConflict?: string }): Promise<{ data: any; error: any }> {
    const table = this.tableName;
    const items = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
    const conflictKeys = (options?.onConflict || 'id').split(',').map(s => s.trim());

    items.forEach(item => {
      const existIdx = store[table].findIndex(x => conflictKeys.every(k => x[k] == item[k]));
      if (existIdx >= 0) {
        const oldItem = { ...store[table][existIdx] };
        Object.assign(store[table][existIdx], item, { updated_at: new Date().toISOString() });
        notifyRealtime(table, 'UPDATE', store[table][existIdx], oldItem);
      } else {
        const cloned = { ...item };
        if (!cloned.id) cloned.id = Date.now();
        if (!cloned.uuid) cloned.uuid = 'uuid-mock-' + Date.now();
        store[table].push(cloned);
        notifyRealtime(table, 'INSERT', cloned, null);
      }
    });

    return Promise.resolve({ data: items, error: null });
  }
}

// Realtime Channel Mock
class MockChannel {
  private channelName: string;
  private callbacks: Array<{ filter: any, cb: (payload: any) => void }> = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(eventType: string, filter: any, callback: (payload: any) => void) {
    this.callbacks.push({ filter, cb: callback });
    return this;
  }

  subscribe(statusCallback?: (status: string) => void) {
    const listener = (event: { table: string; eventType: string; new: any; old: any }) => {
      this.callbacks.forEach(({ filter, cb }) => {
        // Chỉ gọi callback nếu table trùng với filter
        if (filter && filter.table && filter.table !== event.table) return;
        
        try {
          cb({
            eventType: event.eventType,
            new: event.new,
            old: event.old,
            table: event.table
          });
        } catch (e) {
          console.error('Channel callback error:', e);
        }
      });
    };

    realtimeListeners.push(listener);
    if (statusCallback) {
      setTimeout(() => statusCallback('SUBSCRIBED'), 10);
    }
    return this;
  }

  unsubscribe() {
    return true;
  }
}

export const mockSupabase = {
  from(table: string) {
    return new MockQueryBuilder(table);
  },
  channel(name: string) {
    return new MockChannel(name);
  },
  removeChannel(channel: any) {
    return true;
  }
};
