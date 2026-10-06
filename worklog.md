---
Task ID: install-engineering-standards-skill
Agent: main
Task: Install uploaded engineering/design standards files (skills.md, design-skills.md) as a reusable project skill.

Work Log:
- Read /home/z/my-project/upload/skills.md — sections 1–34 (engineering & operations standards).
- Read /home/z/my-project/upload/design-skills.md — sections 35–55 (design engineering system).
- Created new skill directory: /home/z/my-project/skills/engineering-standards/.
- Copied skills.md → references/engineering.md (sections 1–34: core engineering, system design, performance, security, SEO, accessibility, AI agents, deployment, testing, CI/CD, documentation, ADR).
- Copied design-skills.md → references/design.md (sections 35–55: design engineering system, tokens, UI/UX, responsive, 2D/3D, animation, interaction state machines, math/physics, collision, camera, procedural generation, visual perf, design-to-code, component architecture, data viz, design QA).
- Wrote SKILL.md entry point with metadata frontmatter (name, description, trigger keywords) and usage guide covering when to use, how to use, checklist routing, and the final engineering+design rules.
- Verified file layout: SKILL.md + references/engineering.md (23.8KB) + references/design.md (36.7KB).

Stage Summary:
- New skill installed at /home/z/my-project/skills/engineering-standards/.
- Skill name: `engineering-standards`.
- Two reference files cover 55 numbered sections forming one coherent standard for fast/secure/scalable/accessible/SEO-friendly/observable/testable/maintainable/deployable software PLUS beautiful/usable/accessible/responsive/fast/consistent/interactive/mathematically-correct/physically-predictable/maintainable design.
- Skill is auto-loadable on engineering-standards / production-readiness / system-design / design-system / performance / security / accessibility / SEO / AI-agent / design-tokens / component-architecture / design-QA triggers.
- Files preserved verbatim from upload; no content modification.
