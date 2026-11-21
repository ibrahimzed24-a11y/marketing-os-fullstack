#!/usr/bin/env node
/**
 * Marketing OS — Unified LLM Gateway (Google AI Studio Primary + OpenRouter Fallback)
 *
 * Implements end-to-end resilient completion:
 *   1. Primary: Google AI Studio (Gemini) using GEMINI_API_KEY
 *   2. Fallback: OpenRouter using OPENROUTER_API_KEY (via @openrouter/sdk or OpenAI client)
 *
 * Usage:
 *   node scripts/llm_gateway.js [prompt] [--model <model_slug>] [--force-fallback]
 *
 * Example:
 *   node scripts/llm_gateway.js "Draft a high-converting headline for an AI marketing platform."
 *   node scripts/llm_gateway.js --model meta-llama/llama-3.3-70b-instruct:free "Compare SEO vs PPC."
 *   node scripts/llm_gateway.js --force-fallback --model anthropic/claude-3.5-sonnet "Explain agent swarms."
 */

require('dotenv').config();
const { OpenRouter } = require('@openrouter/sdk');
const OpenAI = require('openai');

// Configuration
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const APP_URL = process.env.APP_URL || 'https://marketing-os-fullstack.vercel.app';
const APP_TITLE = 'Marketing OS';

// Parse CLI Arguments
const args = process.argv.slice(2);
let customModel = 'anthropic/claude-3.5-sonnet';
let forceFallback = false;
let promptParts = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) {
    customModel = args[++i];
  } else if (args[i] === '--force-fallback') {
    forceFallback = true;
  } else {
    promptParts.push(args[i]);
  }
}

const prompt = promptParts.join(' ').trim() || 'Provide a 2-sentence executive summary of autonomous multi-agent marketing operations.';

/**
 * 1. Primary: Call Google AI Studio (Gemini)
 */
async function callGoogleAIStudio(promptText, model = 'gemini-1.5-flash') {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment or .env');
  }

  const startTime = Date.now();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });

  const latency = Date.now() - startTime;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google AI Studio HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('No candidate response returned by Google AI Studio');

  return {
    provider: 'Google AI Studio',
    model,
    text: reply.trim(),
    latencyMs: latency,
    usage: data?.usageMetadata || null
  };
}

/**
 * 2. Fallback: Call OpenRouter via official SDK or OpenAI Client
 */
async function callOpenRouter(promptText, modelSlug) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment or .env');
  }

  const startTime = Date.now();

  // We use OpenAI client pointed at OpenRouter endpoint for reliable streaming & completion
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': APP_URL,
      'X-Title': APP_TITLE
    }
  });

  const completion = await openai.chat.completions.create({
    model: modelSlug,
    messages: [
      { role: 'system', content: 'You are an expert marketing intelligence assistant in Marketing OS.' },
      { role: 'user', content: promptText }
    ],
    temperature: 0.7,
    max_tokens: 1024
  });

  const latency = Date.now() - startTime;
  const reply = completion?.choices?.[0]?.message?.content;
  if (!reply) throw new Error(`No completion choices returned by OpenRouter for model '${modelSlug}'`);

  return {
    provider: 'OpenRouter (Fallback Gateway)',
    model: modelSlug,
    text: reply.trim(),
    latencyMs: latency,
    usage: completion?.usage || null
  };
}

/**
 * Main Orchestration with Auto-Fallback
 */
async function main() {
  console.log('='.repeat(70));
  console.log('🚀 Marketing OS — Resilient LLM Gateway');
  console.log(`📋 Prompt: "${prompt}"`);
  console.log(`🎯 Primary Target: Google AI Studio (gemini-1.5-flash)`);
  console.log(`🛡️ Fallback Target: OpenRouter (${customModel})`);
  console.log('='.repeat(70) + '\n');

  // Check OpenRouter key check requirement
  if (!OPENROUTER_API_KEY) {
    console.warn('⚠️  NOTICE: OPENROUTER_API_KEY is currently unset.');
    console.warn('👉 Please create an API key at https://openrouter.ai/keys and export it:');
    console.warn('   export OPENROUTER_API_KEY="sk-or-v1-..."\n');
  }

  // Attempt Primary (Google AI Studio)
  if (!forceFallback) {
    try {
      console.log('⏳ Attempting Primary Engine [Google AI Studio]...');
      const result = await callGoogleAIStudio(prompt);
      console.log('\n✅ [PRIMARY SUCCESS — Google AI Studio]');
      console.log(`⏱️ Latency: ${result.latencyMs}ms | Model: ${result.model}`);
      console.log('─'.repeat(70));
      console.log(result.text);
      console.log('─'.repeat(70));
      return;
    } catch (primaryErr) {
      console.warn(`\n⚠️ Primary [Google AI Studio] failed: ${primaryErr.message}`);
      console.log('🔄 Triggering automated fallback to OpenRouter...\n');
    }
  } else {
    console.log('⚡ Force-fallback flag enabled. Skipping Primary...\n');
  }

  // Attempt Fallback (OpenRouter)
  try {
    if (!OPENROUTER_API_KEY) {
      console.error('❌ Cannot execute fallback: OPENROUTER_API_KEY environment variable is not set.');
      console.error('👉 Visit https://openrouter.ai/keys to generate your key, then set:');
      console.error('   export OPENROUTER_API_KEY="sk-or-v1-your-key-here"');
      process.exit(1);
    }

    console.log(`⏳ Attempting Fallback Engine [OpenRouter] with model '${customModel}'...`);
    const fallbackResult = await callOpenRouter(prompt, customModel);
    console.log(`\n✅ [FALLBACK SUCCESS — OpenRouter (${fallbackResult.model})]`);
    console.log(`⏱️ Latency: ${fallbackResult.latencyMs}ms | Model: ${fallbackResult.model}`);
    console.log('─'.repeat(70));
    console.log(fallbackResult.text);
    console.log('─'.repeat(70));
  } catch (fallbackErr) {
    console.error(`\n❌ Fallback [OpenRouter] failed: ${fallbackErr.message}`);
    console.error('\nTroubleshooting tips:');
    console.error('1. Check that OPENROUTER_API_KEY is valid at https://openrouter.ai/keys');
    console.error('2. Verify that the model slug exists at https://openrouter.ai/models');
    console.error('3. For free experimentation, try: --model meta-llama/llama-3.3-70b-instruct:free');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal execution error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  callGoogleAIStudio,
  callOpenRouter
};
