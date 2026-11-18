/**
 * Marketing OS — Runtime Skill Engine & Anti-Slop Quality Gate
 *
 * Loads real SKILL.md packs installed in `/skills` from:
 *   - blader/humanizer (v4.0.0)
 *   - Leonxlnx/taste-skill (design-taste-frontend v2.5.1)
 *   - nexu-io/open-design (dashboard, email-marketing, critique)
 *   - addyosmani/agent-skills (doubt-driven, security, context-engineering, etc.)
 *
 * Injects department-matched directives into Agent prompts and runs deterministic
 * Humanizer / Anti-Slop quality linting on generated deliverables.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const SKILL_CATALOG = [
  {
    id: 'humanizer',
    name: 'Humanizer (Anti-AI-Slop Writing)',
    source_repo: 'https://github.com/blader/humanizer.git',
    version: '4.0.0',
    file: 'humanizer/SKILL.md',
    departments: ['research', 'sales', 'creative'],
    pipelines: ['*'],
    directive: [
      '[SKILL: blader/humanizer v4.0.0]',
      '- Write plain, specific, human prose. Every sentence must add a new fact or decision.',
      '- NEVER use "not just/only X, but Y" contrasts, dramatic one-line closers ("That is the real win", "Let that sink in"), or staged openers ("Let\'s dive in", "Here\'s what you need to know").',
      '- Eliminate stock AI vocabulary (delve, tapestry, landscape, foster, underscore, pivotal, seamless, game-changer, cutting-edge, unlock the power).',
      '- Avoid forced triads and em-dash overuse. Keep all concrete numbers, names, and verifiable facts intact.'
    ].join('\n')
  },
  {
    id: 'design-taste-frontend',
    name: 'Taste Skill (Anti-Slop Frontend & Landing Pages)',
    source_repo: 'https://github.com/Leonxlnx/taste-skill.git',
    version: '2.5.1',
    file: 'design-taste-frontend/SKILL.md',
    departments: ['creative'],
    pipelines: ['landing-page', 'brand-kit', 'ads-creative'],
    directive: [
      '[SKILL: Leonxlnx/taste-skill v2.5.1]',
      '- Build pages a real company would ship: state plainly what is sold, show real UI or realistic framing, never generic AI-slop templates.',
      '- House rules: equal left/right edges, one clear idea per section, no redundant captions under visuals, crisp hierarchy (h1 names category + buyer, verb+object CTAs).',
      '- Avoid gratuitous purple/violet gradients, cluttered cards, or filler testimonials. Keep copy tight (60-80 words per screen outside UI blocks).',
      '- Include subtle purposeful hover/press micro-interactions and clean responsive layout down to 390px.'
    ].join('\n')
  },
  {
    id: 'open-design-email',
    name: 'OpenDesign Email Marketing Craft',
    source_repo: 'https://github.com/nexu-io/open-design.git',
    version: '1.0',
    file: 'open-design/email-marketing/SKILL.md',
    departments: ['sales', 'creative'],
    pipelines: ['email-campaign', 'deal_proposal'],
    directive: [
      '[SKILL: nexu-io/open-design — email-marketing]',
      '- Treat every email as a focused artifact: one clear idea, one primary CTA, zero filler.',
      '- For HTML emails: centered 600-680px single column, clean masthead, concise eyebrow, direct 2-3 sentence body, single solid CTA button, and compliant unsubscribe footer.'
    ].join('\n')
  },
  {
    id: 'open-design-critique',
    name: 'OpenDesign 5-Dimension Design Critique',
    source_repo: 'https://github.com/nexu-io/open-design.git',
    version: '1.0',
    file: 'open-design/critique/SKILL.md',
    departments: ['creative'],
    pipelines: ['landing-page', 'brand-kit', 'social-content', 'ads-creative'],
    directive: [
      '[SKILL: nexu-io/open-design — 5-dim critique]',
      '- Self-review every creative deliverable across 5 dimensions (0-10): Philosophy, Visual Hierarchy, Detail, Functionality, Innovation.',
      '- Include concise Keep / Fix / Quick-wins notes inside your Admin Report.'
    ].join('\n')
  },
  {
    id: 'open-design-dashboard',
    name: 'OpenDesign Dashboard & Data UI',
    source_repo: 'https://github.com/nexu-io/open-design.git',
    version: '1.0',
    file: 'open-design/dashboard/SKILL.md',
    departments: ['creative'],
    pipelines: ['landing-page'],
    directive: [
      '[SKILL: nexu-io/open-design — dashboard]',
      '- Use semantic HTML (<header>, <main>, <section>), restrained accent usage, and real metric labels — never "Metric A / Metric B" placeholders.'
    ].join('\n')
  },
  {
    id: 'doubt-driven-development',
    name: 'Doubt-Driven Adversarial Self-Check',
    source_repo: 'https://github.com/addyosmani/agent-skills.git',
    version: '1.0',
    file: 'engineering/doubt-driven-development/SKILL.md',
    departments: ['research', 'sales', 'creative'],
    pipelines: ['*'],
    directive: [
      '[SKILL: addyosmani/agent-skills — doubt-driven-development]',
      '- A confident claim is not a verified one. Before finalizing any deliverable, challenge your own assumptions: flag unverified data, missing client inputs, or external dependencies explicitly instead of inventing facts.'
    ].join('\n')
  },
  {
    id: 'security-and-hardening',
    name: 'Security & Hardening Discipline',
    source_repo: 'https://github.com/addyosmani/agent-skills.git',
    version: '1.0',
    file: 'engineering/security-and-hardening/SKILL.md',
    departments: ['research', 'sales', 'creative'],
    pipelines: ['landing-page', 'email-campaign'],
    directive: [
      '[SKILL: addyosmani/agent-skills — security-and-hardening]',
      '- Never emit raw unsanitized inline script injections, hardcoded secrets, or unescaped user input in generated HTML or email templates.'
    ].join('\n')
  },
  {
    id: 'context-engineering',
    name: 'Context Engineering & Grounding',
    source_repo: 'https://github.com/addyosmani/agent-skills.git',
    version: '1.0',
    file: 'engineering/context-engineering/SKILL.md',
    departments: ['research', 'sales', 'creative'],
    pipelines: ['*'],
    directive: [
      '[SKILL: addyosmani/agent-skills — context-engineering]',
      '- Treat uploaded harness files and verified project inputs as authoritative ground truth; flag gaps explicitly rather than extrapolating.'
    ].join('\n')
  }
];

function getInstalledSkills() {
  return SKILL_CATALOG.map((skill) => {
    const absPath = path.join(SKILLS_ROOT, skill.file);
    let exists = false;
    let bytes = 0;
    try {
      const st = fs.statSync(absPath);
      exists = st.isFile();
      bytes = st.size;
    } catch (_) {
      exists = false;
    }
    return {
      id: skill.id,
      name: skill.name,
      source_repo: skill.source_repo,
      version: skill.version,
      file: `skills/${skill.file}`,
      installed: exists,
      bytes,
      departments: skill.departments,
      pipelines: skill.pipelines
    };
  });
}

function getSkillsForTask(department = 'creative', pipeline = '') {
  const dept = String(department || '').toLowerCase();
  const pipe = String(pipeline || '').toLowerCase();
  return SKILL_CATALOG.filter((s) => {
    const absPath = path.join(SKILLS_ROOT, s.file);
    if (!fs.existsSync(absPath)) return false;
    const deptMatch = s.departments.includes(dept);
    const pipeMatch = s.pipelines.includes('*') || s.pipelines.includes(pipe);
    return deptMatch && pipeMatch;
  });
}

function buildSkillDirectives(department, pipeline) {
  const matched = getSkillsForTask(department, pipeline);
  return {
    skills: matched.map((s) => ({ id: s.id, name: s.name, version: s.version, source_repo: s.source_repo })),
    promptBlock: matched.map((s) => s.directive).join('\n\n')
  };
}

/**
 * Deterministic Humanizer + Anti-Slop Quality Linter (inspired by blader/humanizer & taste-skill/copy-lint).
 */
function lintDeliverableQuality(text = '', { skillsApplied = [] } = {}) {
  const content = String(text || '');
  const tells = [];

  const rules = [
    { id: 'humanizer_not_x_but_y', label: 'Not X but Y contrast', penalty: 12, regex: /\bnot\s+(?:just|only|merely)\b[^.!?\n]{1,90}\bbut\b/gi },
    { id: 'humanizer_dramatic_closer', label: 'Dramatic one-line closer', penalty: 12, regex: /\b(that is the real win|that distinction matters|let that sink in|read that again)\b/gi },
    { id: 'humanizer_deep_saying', label: 'Inflated aphorism', penalty: 10, regex: /\b(at its core|the real question is|what really matters|the heart of the matter|the architecture of)\b/gi },
    { id: 'humanizer_staged_opener', label: 'Staged run-up opener', penalty: 10, regex: /\b(let'?s dive in|let'?s explore|here'?s what you need to know|without further ado|real talk)\b/gi },
    { id: 'humanizer_ai_vocab', label: 'Stock AI vocabulary', penalty: 8, regex: /\b(delve|tapestry|testament to|pivotal|foster(?:ing)?|underscore[ds]?|ever-evolving|game-?changer|cutting-edge|unlock(?:ing)? the power|seamless(?:ly)?)\b/gi }
  ];

  let totalPenalty = 0;
  for (const rule of rules) {
    const matches = content.match(rule.regex);
    if (matches && matches.length > 0) {
      totalPenalty += Math.min(rule.penalty * matches.length, 25);
      tells.push({
        rule_id: rule.id,
        label: rule.label,
        count: matches.length,
        samples: matches.slice(0, 3)
      });
    }
  }

  const emDashCount = (content.match(/—/g) || []).length;
  if (emDashCount > 6) {
    totalPenalty += 8;
    tells.push({ rule_id: 'humanizer_em_dash_overuse', label: 'Excessive em-dashes', count: emDashCount, samples: ['—'] });
  }

  const score = Math.max(0, 100 - totalPenalty);
  return {
    humanizer_score: score,
    passed_quality_gate: score >= 75,
    tells_found: tells,
    skills_applied: skillsApplied.map((s) => s.id)
  };
}

module.exports = {
  SKILL_CATALOG,
  getInstalledSkills,
  getSkillsForTask,
  buildSkillDirectives,
  lintDeliverableQuality
};
