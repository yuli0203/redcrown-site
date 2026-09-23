// Worker entry point: the HTTP handler (index.js) and the Ledger Durable
// Object, the single place where numbers, documents and payment claims live.
import { DurableObject } from 'cloudflare:workers';
import { LedgerCore, durableSql } from './ledger.js';
import app from './index.js';

export class Ledger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new LedgerCore(durableSql(ctx.storage.sql));
  }

  // One RPC entry point; LedgerCore methods run synchronously, one call at a time.
  async call(method, args) {
    if (method.startsWith('#') || typeof this.core[method] !== 'function') throw new Error('unknown ledger method');
    return this.core[method](...args);
  }
}

export default app;
