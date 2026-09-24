/*
 * The one place this engine talks to Claude.
 *
 * Two shapes are used: `explore` lets the model search the live web and answer
 * in prose, and `structured` forces a JSON document that matches a schema. The
 * split matters - a search answer carries citations, which cannot be combined
 * with a response format, so research runs as explore then structured.
 */
'use strict';
const sdk = require('@anthropic-ai/sdk');
// The SDK ships ESM and CJS builds; take whichever shape this install exposes.
const Anthropic = sdk.Anthropic || sdk.default || sdk;

const DEFAULT_MODEL = 'claude-opus-5';
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

let cached = null;
function client() {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error('ANTHROPIC_API_KEY is not set. Locally: export it. In CI: add it as a repository secret.');
    }
    cached = new Anthropic();
  }
  return cached;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* The API is billed per call, so retry only what a retry can fix. */
async function withRetries(label, call, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await call();
    } catch (error) {
      const status = error && error.status;
      lastError = error;
      if (status && !RETRYABLE.has(status)) throw error;
      if (attempt === attempts) break;
      const wait = 2000 * 2 ** (attempt - 1);
      console.warn(`[journal] ${label} failed (${status || error.message}); retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastError;
}

/* A refusal arrives as a normal 200, so it has to be checked explicitly. */
function assertAnswered(message, label) {
  if (message.stop_reason === 'refusal') {
    const detail = message.stop_details || {};
    throw new Error(`Claude declined the ${label} request (${detail.category || 'unspecified'}). Adjust the prompt or the topic.`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`The ${label} response hit max_tokens before finishing. Raise maxTokens or narrow the request.`);
  }
}

const textOf = message => message.content
  .filter(block => block.type === 'text')
  .map(block => block.text)
  .join('\n')
  .trim();

/* Prose answer, optionally with live web search. */
async function explore({ model = DEFAULT_MODEL, system, prompt, effort = 'high', maxTokens = 16000, search = 0 }) {
  const tools = search
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: search }]
    : undefined;
  const message = await withRetries('search', async () => {
    const stream = client().messages.stream({
      model, max_tokens: maxTokens, system,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      ...(tools ? { tools } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    return stream.finalMessage();
  });
  assertAnswered(message, 'research');
  return { text: textOf(message), usage: message.usage };
}

/* JSON answer constrained by a schema, so the caller can trust the shape. */
async function structured({ model = DEFAULT_MODEL, system, prompt, schema, effort = 'high', maxTokens = 32000, label = 'generation' }) {
  const message = await withRetries(label, async () => {
    const stream = client().messages.stream({
      model, max_tokens: maxTokens, system,
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    });
    return stream.finalMessage();
  });
  assertAnswered(message, label);
  const body = textOf(message);
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`${label} returned text that is not JSON: ${body.slice(0, 400)}`);
  }
}

module.exports = { client, explore, structured, DEFAULT_MODEL };
