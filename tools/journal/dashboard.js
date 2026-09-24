#!/usr/bin/env node
/*
 * The journal dashboard: the control room for /blog/.
 *
 * It runs on this machine only. The server binds to the loopback interface, so
 * nothing outside the computer can reach it, and every request must carry the
 * one-time key printed at startup - that stops a page open in another tab from
 * driving it behind your back. No password, because nothing is exposed; the
 * real gate is that the site's secrets live in the environment and in GitHub,
 * never in this repo.
 *
 *   node tools/journal/dashboard.js            http://127.0.0.1:4173
 *   node tools/journal/dashboard.js --port 5000
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const posts = require('./lib/posts.js');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const CONFIG = path.join(HERE, 'config.json');
const QUEUE = path.join(HERE, 'keywords.json');
const REPORT = path.join(HERE, 'audit-report.md');
const KEY = crypto.randomBytes(16).toString('hex');
const argv = process.argv.slice(2);
const port = Number(argv[argv.indexOf('--port') + 1]) || 4173;

/* Tasks are a fixed list. The dashboard cannot be talked into running
   something else, whatever arrives in the request body. */
const TASKS = {
  research: { label: 'מחקר מילות מפתח', args: ['research.js'], needsKey: true },
  write: { label: 'כתיבת מאמר', args: ['write.js'], needsKey: true },
  build: { label: 'בנייה מחדש של הבלוג', args: ['build.js'] },
  audit: { label: 'אודיט מקומי', args: ['audit.js'] },
  'audit-deep': { label: 'אודיט מול התוצאות החיות', args: ['audit.js', '--deep'], needsKey: true },
  share: { label: 'שיתוף לפייסבוק', args: ['facebook.js'], needsSocial: true },
  import: { label: 'ייבוא מ-Soro', args: ['import.js'] },
};

const jobs = new Map();

function startJob(name, extra = []) {
  const task = TASKS[name];
  const id = crypto.randomBytes(6).toString('hex');
  const job = { id, name, label: task.label, output: '', done: false, code: null, started: Date.now() };
  jobs.set(id, job);
  const child = spawn(process.execPath, [path.join(HERE, ...task.args), ...extra], { cwd: HERE, env: process.env });
  const append = chunk => { job.output += chunk.toString(); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('close', code => { job.done = true; job.code = code; });
  child.on('error', error => { job.output += `\n${error.message}`; job.done = true; job.code = 1; });
  return job;
}

const readJson = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

function state() {
  const cfg = posts.config();
  const all = posts.all();
  const queue = readJson(QUEUE) || [];
  const social = cfg.social.facebook;
  return {
    config: cfg,
    site: cfg.site,
    posts: all.map(post => ({
      slug: post.slug, title: post.title, excerpt: post.excerpt, isoDate: post.isoDate,
      words: posts.wordCount(post), keyword: post.keyword || '', source: post.source || 'journal',
      faq: (post.faq || []).length, links: (post.internalLinks || []).length,
      shared: Boolean(post.shared && post.shared.facebook),
      rendered: fs.existsSync(path.join(ROOT, 'blog', post.slug, 'index.html')),
    })),
    keywords: queue,
    audit: fs.existsSync(REPORT) ? fs.readFileSync(REPORT, 'utf8') : '',
    secrets: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
      facebookPage: Boolean(process.env[social.pageIdEnv]),
      facebookToken: Boolean(process.env[social.tokenEnv]),
    },
    tasks: Object.entries(TASKS).map(([name, task]) => ({ name, label: task.label })),
  };
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = type.startsWith('application/json') ? JSON.stringify(body) : body;
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(payload);
}

const collect = req => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
    if (data.length > 1e6) reject(new Error('body too large'));
  });
  req.on('end', () => resolve(data));
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const host = (req.headers.host || '').split(':')[0];
  if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, { error: 'local access only' });

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const key = url.searchParams.get('key');
    if (key !== KEY) return send(res, 403, 'Open the link printed in the terminal - it carries the session key.', 'text/plain; charset=utf-8');
    return send(res, 200, fs.readFileSync(path.join(HERE, 'dashboard', 'index.html'), 'utf8'), 'text/html; charset=utf-8');
  }

  // Every API call must present the key as a header a cross-origin page cannot set.
  if (req.headers['x-journal-key'] !== KEY) return send(res, 403, { error: 'bad key' });

  try {
    if (url.pathname === '/api/state') return send(res, 200, state());

    if (url.pathname === '/api/config' && req.method === 'PUT') {
      const next = JSON.parse(await collect(req));
      if (!next || !next.site || !next.brandDna) return send(res, 400, { error: 'that is not a journal config' });
      fs.writeFileSync(CONFIG, JSON.stringify(next, null, 2) + '\n');
      return send(res, 200, { saved: true });
    }

    if (url.pathname === '/api/run' && req.method === 'POST') {
      const { task, keyword } = JSON.parse(await collect(req) || '{}');
      if (!TASKS[task]) return send(res, 400, { error: 'unknown task' });
      const extra = task === 'write' && keyword ? ['--keyword', String(keyword)] : [];
      return send(res, 200, startJob(task, extra));
    }

    if (url.pathname.startsWith('/api/job/')) {
      const job = jobs.get(url.pathname.split('/').pop());
      return job ? send(res, 200, job) : send(res, 404, { error: 'no such job' });
    }
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
  return send(res, 404, { error: 'not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`\n  Red Crown Journal - לוח הבקרה\n`);
  console.log(`  http://127.0.0.1:${port}/?key=${KEY}\n`);
  console.log('  הקישור תקף כל עוד התהליך רץ. Ctrl+C לסגירה.\n');
});
