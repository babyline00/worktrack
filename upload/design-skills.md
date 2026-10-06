# Project Engineering Skills & Standards

## Purpose

Use this file as the default engineering standard for all new web, SaaS, API, AI-agent, automation, dashboard, and e-commerce projects. The goal is to build software that is **fast, secure, maintainable, scalable, accessible, SEO-friendly, observable, and production-ready** from the beginning.

---

# 1. Core Engineering Principles

- Prefer simple, boring, maintainable architecture over unnecessary complexity.
- Design for production from the first implementation, not as a later cleanup task.
- Reuse existing libraries and project utilities before creating custom replacements.
- Keep business logic independent from UI, framework, database, and external providers where practical.
- Use clear naming, small modules, typed interfaces, validation, and predictable error handling.
- Never hard-code secrets, credentials, API keys, tokens, or environment-specific configuration.
- Make important operations idempotent where possible.
- Design APIs and database schemas around real use cases and expected growth.
- Measure performance instead of guessing.
- Automate repetitive checks with linting, formatting, tests, CI, and security scanning.

---

# 2. Project Discovery Before Coding

Before implementation:

1. Inspect the existing repository structure.
2. Identify the framework, runtime, package manager, database, deployment target, and existing conventions.
3. Read existing documentation and configuration files.
4. Identify reusable components and utilities.
5. Inspect database schema and migrations before changing data models.
6. Identify authentication, authorization, integrations, queues, cron jobs, storage, and external APIs.
7. Define functional requirements and non-functional requirements.
8. Define expected traffic, data volume, concurrency, latency targets, and availability requirements.
9. Identify deployment limitations such as shared hosting, cPanel, serverless, containers, or VPS.
10. Produce an implementation plan before making large architectural changes.

Do not rewrite working systems merely for stylistic reasons.

---

# 3. System Design

Every significant project should have a lightweight system design covering:

- Users and roles
- Main business workflows
- Frontend architecture
- Backend/API architecture
- Database architecture
- Authentication and authorization
- File/object storage
- Caching
- Background jobs and queues
- External integrations
- Observability
- Security boundaries
- Deployment architecture
- Backup and disaster recovery
- Scaling strategy
- Failure modes

## Recommended logical architecture

```text
Browser / Mobile / Client
        |
        v
CDN / Edge / WAF
        |
        v
Frontend / BFF / API Gateway
        |
   +----+----------------+
   |                     |
   v                     v
Application API      Background Jobs
   |                     |
   +----------+----------+
              |
       Service / Domain Layer
              |
     +--------+---------+
     |        |         |
     v        v         v
 Database   Cache    Object Storage
     |
     v
Backups / Replicas
```

For small projects, keep this logical separation without creating unnecessary microservices.

## Monolith vs services

Prefer a modular monolith until independent deployment, scaling, ownership, or reliability requirements justify service separation.

Use microservices only when there is a clear operational reason such as:

- independently scaling workloads
- independently deploying high-risk components
- strict isolation requirements
- separate team ownership
- different runtime requirements
- asynchronous/event-driven workloads at meaningful scale

---

# 4. Fast Website / Performance Engineering

Performance is a first-class feature.

## Target principles

Aim for:

- Fast first response
- Minimal JavaScript
- Minimal CSS
- Small HTML payloads
- Optimized images
- Efficient database queries
- Aggressive but safe caching
- CDN/edge delivery where useful
- Streaming or progressive rendering for expensive content
- No unnecessary client-side work

## Loading strategy

### Critical rendering path

1. Return useful HTML quickly.
2. Inline only genuinely critical CSS when justified.
3. Defer non-critical JavaScript.
4. Preload only high-priority resources.
5. Avoid render-blocking third-party scripts.
6. Lazy-load below-the-fold media.
7. Reserve image dimensions to prevent layout shift.
8. Use modern image formats such as AVIF/WebP where supported.
9. Compress text assets with Brotli or gzip.
10. Use long-lived immutable caching for fingerprinted static assets.

### JavaScript

- Prefer server rendering or static rendering for content-heavy pages.
- Ship only the JavaScript required for the current page.
- Split large bundles.
- Lazy-load expensive components.
- Remove unused dependencies.
- Avoid large client-side state stores unless needed.
- Avoid hydration of components that do not need interactivity.
- Use Web Workers for appropriate CPU-heavy browser tasks.

### Images

- Resize images to their actual display size.
- Generate responsive variants with `srcset`/`sizes`.
- Use `loading="lazy"` for non-critical images.
- Do not lazy-load the primary above-the-fold hero image when it is the LCP element.
- Use `fetchpriority="high"` selectively for the primary LCP resource.
- Strip unnecessary metadata.
- Generate thumbnails rather than downloading full-size images everywhere.

### Fonts

- Use a limited number of font families and weights.
- Prefer self-hosted fonts when appropriate.
- Preload only critical fonts.
- Use `font-display: swap` or an appropriate fallback strategy.
- Avoid loading dozens of unused font weights.

---

# 5. Core Web Vitals

Track and optimize:

- **LCP** — Largest Contentful Paint
- **INP** — Interaction to Next Paint
- **CLS** — Cumulative Layout Shift

Also monitor:

- TTFB
- FCP
- total transfer size
- JavaScript execution time
- long tasks
- API latency
- database latency

Performance work should be validated with real measurements in addition to local development testing.

---

# 6. Backend Performance

- Avoid N+1 database queries.
- Select only required columns.
- Add indexes based on actual query patterns.
- Paginate large collections.
- Use cursor pagination for very large datasets where appropriate.
- Cache expensive and stable reads.
- Batch writes when appropriate.
- Use connection pooling.
- Move long-running operations to background jobs.
- Stream large files instead of loading them fully into memory.
- Apply request timeouts to external services.
- Use retries with exponential backoff only for retryable failures.
- Prevent retry storms.
- Use circuit breakers where external dependency failures can cascade.

---

# 7. Database Design

- Use migrations for schema changes.
- Use foreign keys and constraints where appropriate.
- Add indexes for real query patterns.
- Avoid indexing every column.
- Use transactions for multi-step consistency requirements.
- Keep large blobs out of relational tables when object storage is more appropriate.
- Add audit fields such as `created_at` and `updated_at` where useful.
- Use soft deletion only when there is a concrete business requirement.
- Plan retention and archival for high-volume tables.
- Back up production databases automatically.
- Test restoration, not only backup creation.

---

# 8. Caching Strategy

Use cache layers deliberately:

```text
Browser Cache
     -> CDN / Edge Cache
     -> Application Cache
     -> Database
```

Possible technologies include browser HTTP caching, CDN caching, Redis, in-process caches, and database query/result caching.

Rules:

- Define cache keys clearly.
- Define TTLs.
- Define invalidation rules.
- Avoid caching private user data in shared caches.
- Prevent cache stampedes.
- Never rely on cache as the only source of durable data.

---

# 9. API Design

- Version public APIs when compatibility requires it.
- Use consistent resource naming.
- Validate all input at the boundary.
- Return predictable error structures.
- Use appropriate HTTP status codes.
- Support pagination, filtering, sorting, and search intentionally.
- Apply authentication and authorization to every protected operation.
- Add rate limits to abuse-prone endpoints.
- Use idempotency keys for operations where duplicate requests can cause damage.
- Document APIs with OpenAPI where appropriate.
- Never expose internal stack traces or secrets to clients.

---

# 10. Security

Security must be designed into the system rather than added after deployment.

## Application security

- Validate and sanitize untrusted input.
- Use parameterized queries/ORM protections against SQL injection.
- Protect against XSS.
- Protect state-changing requests against CSRF where applicable.
- Prevent SSRF in URL-fetching features.
- Validate file uploads by type, size, extension, content, and storage location.
- Prevent path traversal.
- Use secure session handling.
- Apply least privilege.
- Enforce authorization server-side; never trust UI restrictions.
- Avoid exposing sensitive information in logs.
- Add security headers where appropriate.
- Configure CORS narrowly.
- Use HTTPS in production.
- Keep dependencies patched.

## Authentication

- Store passwords using strong password hashing such as Argon2id or an appropriate modern equivalent.
- Never store plaintext passwords.
- Support secure session expiration and revocation.
- Protect login and password-reset endpoints against abuse.
- Use MFA for sensitive applications where appropriate.
- Rotate compromised credentials immediately.

## Secrets

Never commit:

- API keys
- database passwords
- private keys
- OAuth client secrets
- JWT signing secrets
- cloud credentials

Use environment variables or a proper secret manager.

## Security headers

Consider:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame-ancestors / appropriate clickjacking protection

Do not blindly copy a header configuration; test it against application requirements.

---

# 11. SEO

For public websites, implement technical SEO from the beginning.

- Semantic HTML.
- Correct title and meta description.
- Canonical URLs.
- XML sitemap.
- robots.txt.
- Open Graph metadata.
- Twitter/X card metadata where useful.
- Structured data/schema where applicable.
- Clean URL architecture.
- Proper heading hierarchy.
- Internal linking.
- 404 and redirect handling.
- Pagination/canonical strategy for large collections.
- Fast mobile rendering.
- Accessible navigation.
- Avoid indexing duplicate, private, filtered, or low-value URLs unintentionally.

For dynamic sites, generate metadata from authoritative content rather than duplicating it manually.

---

# 12. Accessibility

Target WCAG-aligned accessible interfaces.

- Use semantic HTML first.
- Keyboard navigation must work.
- Provide visible focus states.
- Use labels for form controls.
- Provide useful alt text for meaningful images.
- Mark decorative images appropriately.
- Maintain adequate color contrast.
- Do not rely on color alone to communicate state.
- Use ARIA only when native HTML is insufficient.
- Support screen readers for important workflows.
- Respect reduced-motion preferences.

---

# 13. Frontend Architecture

- Use reusable components.
- Keep components focused.
- Separate presentation from business logic where practical.
- Keep forms validated on both client and server.
- Handle loading, empty, success, error, and permission states.
- Use optimistic UI only where rollback is well-defined.
- Avoid unnecessary global state.
- Preserve URL state for useful filters/search where appropriate.
- Design responsive layouts from mobile to desktop.
- Avoid layout shifts caused by asynchronous content.

For Next.js or similar frameworks:

- Prefer server components/rendering for non-interactive content.
- Keep client components small.
- Use route-level code splitting.
- Cache stable server data appropriately.
- Avoid accidentally converting large parts of the application into client components.

---

# 14. UX Standards

Every important page should handle:

- loading state
- empty state
- error state
- success feedback
- permission denied state
- offline/network failure where applicable
- destructive action confirmation

Interfaces should be responsive, keyboard-friendly, and consistent.

Avoid unnecessary animations, popups, spinners, and blocking dialogs.

---

# 15. AI / Agent Projects

For AI systems:

- Separate model provider configuration from business logic.
- Support provider fallback where reliability requires it.
- Use structured outputs when possible.
- Validate model outputs before executing actions.
- Require approval for high-impact or destructive actions.
- Apply tool-level permissions.
- Log model/tool traces without leaking secrets.
- Bound context size and token usage.
- Cache deterministic or reusable work where appropriate.
- Add timeouts and retries for model APIs.
- Design provider abstraction so models can be replaced.
- Never allow model-generated instructions to bypass authorization.
- Treat retrieved web/file content as untrusted input.
- Add prompt-injection defenses for tool-using agents.

Recommended agent flow:

```text
User Request
    -> Intent / Task Analysis
    -> Permission Check
    -> Plan
    -> Tool Selection
    -> Tool Execution
    -> Validation
    -> Optional Human Approval
    -> Result
    -> Audit / Trace
```

---

# 16. Scraping / Crawling Systems

For crawlers and website audit tools:

- Respect robots.txt and applicable site policies.
- Implement concurrency limits.
- Use request timeouts.
- Retry only transient failures.
- Rotate proxies only when legitimately required and permitted.
- Deduplicate URLs and content.
- Normalize URLs.
- Detect canonical URLs.
- Store crawl state incrementally.
- Stream or batch large exports.
- Avoid loading browser automation for pages that can be fetched with HTTP.
- Use browser rendering only when required by JavaScript behavior.
- Cache reusable resources.
- Track status codes, redirects, latency, content type, and crawl errors.
- Prevent infinite crawl loops and unbounded URL generation.

---

# 17. File Uploads and Storage

- Store uploads outside executable web roots where possible.
- Generate server-side filenames.
- Limit file size.
- Validate MIME type and actual file content.
- Scan files where risk warrants it.
- Prevent executable uploads.
- Use object storage for large media when appropriate.
- Use signed URLs for private downloads.
- Apply retention and cleanup policies.

---

# 18. Background Jobs

Use queues for:

- email sending
- image processing
- video processing
- scraping
- report generation
- AI workloads
- imports/exports
- scheduled maintenance

Each job should have:

- unique/job ID
- retry policy
- timeout
- status
- error details
- idempotency strategy
- dead-letter handling where appropriate
- progress reporting for long operations

---

# 19. Observability

Production systems should provide:

- structured logs
- request IDs / correlation IDs
- metrics
- error tracking
- health checks
- dependency health checks
- performance measurements
- audit logs for sensitive actions

Track at minimum:

- request rate
- error rate
- latency
- database latency
- queue depth
- job failures
- cache hit/miss rate where relevant
- resource utilization

Never log passwords, tokens, private keys, full payment details, or unnecessary personal data.

---

# 20. Reliability and Failure Design

Design for failure:

- external APIs can fail
- databases can become unavailable
- queues can back up
- DNS/CDN can fail
- users can submit duplicate requests
- workers can crash midway through a job
- deployments can fail

Use:

- timeouts
- retries with backoff
- idempotency
- graceful degradation
- circuit breakers where appropriate
- health checks
- transactional boundaries
- rollback/feature flags for risky releases
- backups and tested restoration procedures

---

# 21. Deployment

Before production:

- production environment variables configured
- HTTPS enabled
- database migrations tested
- backups configured
- restore process tested
- error monitoring enabled
- logging configured
- security headers reviewed
- CORS reviewed
- rate limiting reviewed
- cron/queue workers verified
- storage permissions reviewed
- build artifacts verified
- cache behavior tested
- rollback procedure documented

For restricted shared hosting/cPanel environments, prefer architecture that matches available runtimes. If Node.js is unavailable, do not assume a Next.js server can run there; consider static export, PHP backend, a supported runtime, or external application hosting.

---

# 22. Testing

Use multiple testing layers:

### Unit tests

Business rules, utility functions, validators, transformations.

### Integration tests

Database, APIs, queues, storage, and external-service adapters.

### End-to-end tests

Critical user journeys such as authentication, checkout, dashboard workflows, and administration.

### Performance tests

Measure representative workloads and concurrency.

### Security tests

Check authentication, authorization, injection risks, uploads, SSRF, dependency vulnerabilities, and exposed secrets.

Do not treat high test coverage as proof of correctness; test important behavior and failure modes.

---

# 23. CI/CD Quality Gates

A production repository should ideally run:

```text
Install
  -> Type Check
  -> Lint
  -> Format Check
  -> Unit Tests
  -> Integration Tests
  -> Build
  -> Security / Dependency Scan
  -> Deployment
  -> Smoke Test
```

Block deployment when critical checks fail.

---

# 24. Code Quality

Use:

- TypeScript strict mode where applicable.
- Python type hints where practical.
- ESLint/formatter or equivalent tooling.
- Ruff/Black/MyPy or project-appropriate Python tooling.
- Clear module boundaries.
- Small functions.
- Explicit error handling.
- No dead code.
- No duplicated business logic.
- No unexplained magic constants.

Comments should explain **why**, not merely repeat what the code does.

---

# 25. Dependency Management

Before adding a dependency:

1. Check whether the framework already provides the feature.
2. Check maintenance activity.
3. Check license compatibility.
4. Check bundle/runtime impact.
5. Check security history.
6. Check whether a smaller dependency solves the problem.

Keep dependencies updated, but test upgrades before production deployment.

---

# 26. Environment Configuration

Maintain separate configuration for:

- development
- testing
- staging
- production

Use environment variables for deployment-specific values.

Document required variables in `.env.example` without including real secrets.

---

# 27. Documentation

Every substantial project should include:

```text
README.md
ARCHITECTURE.md
SECURITY.md
API.md (when applicable)
DEPLOYMENT.md
CHANGELOG.md
.env.example
```

Document:

- setup
- architecture
- environment variables
- database setup
- migrations
- deployment
- troubleshooting
- backup/restore
- security assumptions
- known limitations

---

# 28. Project Structure

Use a structure appropriate to the framework, but keep responsibilities clear.

Example:

```text
project/
├── app/ or src/
│   ├── components/
│   ├── pages/ or routes/
│   ├── features/
│   ├── services/
│   ├── domain/
│   ├── repositories/
│   ├── validators/
│   ├── lib/
│   └── config/
├── tests/
├── scripts/
├── migrations/
├── public/
├── docs/
├── .env.example
├── README.md
├── ARCHITECTURE.md
└── SECURITY.md
```

Do not force this exact structure onto every framework; use the same separation of concerns with framework-native conventions.

---

# 29. Production Readiness Checklist

Before calling a project complete:

- [ ] Requirements implemented
- [ ] Database schema reviewed
- [ ] Authentication implemented securely
- [ ] Authorization tested
- [ ] Input validation implemented
- [ ] Error handling implemented
- [ ] Loading/empty/error UI states implemented
- [ ] Responsive design verified
- [ ] Accessibility reviewed
- [ ] SEO implemented where relevant
- [ ] Images optimized
- [ ] JavaScript bundle reviewed
- [ ] Core Web Vitals measured
- [ ] API performance checked
- [ ] Database indexes reviewed
- [ ] Caching strategy reviewed
- [ ] Rate limiting configured where needed
- [ ] Secrets removed from source control
- [ ] Security headers reviewed
- [ ] Dependency vulnerabilities checked
- [ ] Unit/integration/E2E tests added for critical behavior
- [ ] Logging and monitoring configured
- [ ] Health checks configured
- [ ] Background jobs verified
- [ ] Backup configured
- [ ] Restore tested
- [ ] Deployment documented
- [ ] Rollback plan documented
- [ ] Production smoke test completed

---

# 30. Default Definition of Done

A feature is not complete when the code merely works locally.

A feature is complete when:

1. The intended behavior works.
2. Invalid input is handled safely.
3. Permissions are enforced server-side.
4. Loading, empty, success, and failure states are handled.
5. Data integrity is preserved.
6. Performance is acceptable for the expected workload.
7. Security implications have been reviewed.
8. Tests cover important behavior.
9. Logs/metrics exist where operationally useful.
10. Documentation is updated.
11. Deployment behavior is verified.
12. The implementation does not introduce unnecessary technical debt.

---

# 31. Fast-by-Default Rules

For every new website, ask:

- Can this page be rendered on the server?
- Can this JavaScript be removed?
- Can this API call happen server-side?
- Can this request be cached?
- Can this image be smaller?
- Can this dependency be removed?
- Can this database query be reduced?
- Can this work happen asynchronously?
- Can this third-party script be removed or deferred?
- Can this page load useful content before non-critical content?

**Performance is not a final optimization phase. It is an architectural requirement.**

---

# 32. Default AI Coding-Agent Instructions

When an AI coding agent works on a project using this file:

1. Inspect before editing.
2. Understand existing architecture before introducing new patterns.
3. Make the smallest safe change that solves the problem.
4. Preserve working functionality.
5. Do not silently remove features.
6. Validate changes with tests, lint, type checks, and build checks where available.
7. Review security implications of every new endpoint, upload, integration, credential, and external request.
8. Review performance implications of every new dependency, client component, query, API call, image, and third-party script.
9. Report files changed and validation performed.
10. If a requirement conflicts with deployment limitations, explain the constraint and implement the closest production-safe architecture rather than pretending the unsupported runtime exists.

---

# 33. Architecture Decision Record Template

For important architectural decisions, record:

```md
# ADR: <Decision>

## Context
What problem are we solving?

## Options
What reasonable alternatives were considered?

## Decision
What was selected?

## Reasons
Why was it selected?

## Trade-offs
What are the costs or limitations?

## Consequences
What changes because of this decision?

## Date
YYYY-MM-DD
```

---

# 34. Final Engineering Rule

Build software that is:

**Fast + Secure + Scalable + Accessible + SEO-friendly + Observable + Testable + Maintainable + Deployable.**

Do not optimize only for getting the first version running. Optimize the architecture so the project can continue growing without requiring a complete rewrite.

---

# 35. Design Engineering System

Treat design as an engineering system, not a collection of screenshots.

Every interface should have:

- design tokens
- reusable components
- interaction states
- responsive rules
- accessibility rules
- motion rules
- content rules
- error and empty states
- performance constraints

Prefer consistency over one-off visual decisions.

## Design tokens

Define tokens for:

- colors
- typography
- spacing
- sizing
- radii
- borders
- shadows
- elevation
- z-index layers
- animation duration
- easing curves
- breakpoints

Use semantic tokens such as `color.background`, `color.surface`, `color.text`, `color.primary`, and `color.danger` instead of scattering raw values throughout components.

---

# 36. UI/UX Quality Standards

Before implementing a page, define:

1. Primary user goal.
2. Primary action.
3. Secondary actions.
4. Information hierarchy.
5. Navigation path.
6. Responsive behavior.
7. Loading behavior.
8. Empty behavior.
9. Error behavior.
10. Success feedback.
11. Permission states.
12. Accessibility requirements.

Avoid visual complexity that does not improve comprehension or task completion.

Use progressive disclosure for advanced functionality.

---

# 37. Responsive Design System

Design for real layouts rather than fixed device screenshots.

- Use fluid containers where appropriate.
- Use CSS Grid/Flexbox for layout.
- Prefer responsive typography.
- Avoid unnecessary fixed heights.
- Handle long text gracefully.
- Support touch targets of appropriate size.
- Test narrow mobile widths, tablets, laptops, and large displays.
- Test landscape orientation where relevant.
- Ensure dialogs and menus remain usable at small sizes.
- Never allow horizontal overflow unless intentionally designed.

---

# 38. 2D Graphics

For 2D interfaces, illustrations, diagrams, games, and visual tools:

- Prefer SVG for scalable UI graphics and icons.
- Use Canvas for high-frequency drawing or pixel-oriented rendering.
- Separate geometry from rendering logic.
- Use coordinate systems explicitly.
- Support device-pixel-ratio correctly.
- Avoid unnecessarily large raster assets.
- Compress raster images.
- Use sprite sheets only when they provide a measurable benefit.
- Cache reusable drawing resources.

Useful 2D primitives include:

- points
- lines
- rectangles
- circles
- polygons
- paths
- Bézier curves
- transforms
- clipping regions
- masks

---

# 39. 3D Design and Rendering

For 3D experiences:

- Define world, camera, and object coordinate systems.
- Use reusable models and materials.
- Keep polygon counts appropriate for the target device.
- Compress textures.
- Use texture atlases where useful.
- Prefer instancing for repeated objects.
- Use level-of-detail (LOD) for large scenes.
- Frustum-cull objects outside the camera view.
- Avoid unnecessary transparent materials.
- Reuse geometries and materials.
- Dispose GPU resources correctly.
- Keep post-processing effects proportional to device capability.

Recommended conceptual pipeline:

```text
Input
  -> Scene State
  -> Physics / Logic
  -> Animation
  -> Camera
  -> Culling / LOD
  -> Geometry
  -> Materials / Textures
  -> Lighting
  -> Rendering
  -> Post Processing
  -> Display
```

---

# 40. Icons and Visual Assets

Use a coherent icon language.

- Keep stroke/fill style consistent.
- Keep optical size consistent.
- Use predictable viewBox dimensions.
- Provide accessible labels for meaningful icons.
- Do not use icons alone when the meaning is ambiguous.
- Use tooltips for unfamiliar icon-only controls.
- Prefer a small reusable icon set over hundreds of inconsistent assets.
- Optimize SVGs before shipping.
- Remove unnecessary SVG metadata and path complexity where safe.

---

# 41. Animation and Motion

Animation must communicate state, hierarchy, causality, or spatial relationships.

Use motion for:

- entering/exiting elements
- state changes
- feedback
- navigation transitions
- loading progress
- drag/drop
- expanding/collapsing content
- visualizing physical movement

Avoid animation that delays the user or creates visual noise.

Rules:

- Keep transitions short for ordinary UI feedback.
- Use consistent easing.
- Animate transforms and opacity where possible.
- Avoid animating expensive layout properties unnecessarily.
- Respect `prefers-reduced-motion`.
- Do not block interaction while decorative animation is running.
- Provide deterministic animation state when testing.

---

# 42. Interaction Logic and State Machines

Complex interfaces should use explicit state models.

Example:

```text
idle
  -> loading
  -> success
  -> error
  -> retrying
```

For richer interactions, model:

- current state
- allowed events
- transition conditions
- side effects
- rollback behavior
- persistence requirements

Avoid deeply nested boolean flags such as `isLoading`, `isSaving`, `isError`, `isRetrying`, and `isSuccess` when they can represent contradictory states. Prefer a single explicit state model where practical.

---

# 43. Mathematics and Geometry

Use mathematically correct foundations for visual systems.

Core topics:

- arithmetic
- ratios and proportions
- percentages
- interpolation
- linear interpolation (lerp)
- vectors
- matrices
- coordinate transforms
- dot products
- cross products
- distances
- angles
- trigonometry
- normalization
- projections
- Bézier curves
- bounding boxes
- collision geometry
- quaternions for 3D rotation

Example interpolation:

```text
lerp(a, b, t) = a + (b - a) * t
```

Keep units explicit. Do not mix pixels, meters, degrees, radians, seconds, and normalized coordinates without deliberate conversion.

---

# 44. Physics and Simulation

When implementing physics, distinguish simulation time from rendering time.

Typical concepts:

- position
- velocity
- acceleration
- mass
- force
- impulse
- friction
- restitution
- gravity
- drag
- angular velocity
- torque
- collision detection
- collision response

Basic integration concept:

```text
velocity += acceleration * dt
position += velocity * dt
```

Use a stable timestep for simulations that require deterministic or predictable behavior.

Do not use frame rate directly as a substitute for elapsed time.

---

# 45. Collision Detection

Choose collision algorithms based on object complexity.

Possible approaches:

- point vs rectangle
- circle vs circle
- circle vs rectangle
- AABB
- OBB
- bounding sphere
- ray intersection
- polygon intersection
- spatial hashing
- quadtree
- BVH

Use broad-phase detection to eliminate impossible collisions before expensive narrow-phase tests.

```text
Broad Phase
    -> Candidate Pairs
    -> Narrow Phase
    -> Collision Manifold
    -> Resolution
```

---

# 46. Camera and Coordinate Systems

Always document coordinate conventions.

Define:

- origin
- up axis
- forward direction
- handedness
- world units
- camera projection
- screen coordinates

For 2D and 3D camera systems, separate:

```text
World Space
   -> View / Camera Space
   -> Projection Space
   -> Screen Space
```

This prevents common transformation and orientation bugs.

---

# 47. Procedural Generation

For generated graphics, environments, layouts, or data:

- Use deterministic seeds when reproducibility matters.
- Separate generation from rendering.
- Keep generation parameters configurable.
- Avoid uncontrolled recursion or unbounded generation.
- Cache expensive generated resources.
- Validate generated geometry before rendering.
- Provide predictable fallback behavior.

For procedural systems, record the seed and major parameters so bugs can be reproduced.

---

# 48. Visual Performance

Optimize visual systems based on measurements.

Check:

- frame rate
- frame time
- CPU time
- GPU time
- memory usage
- texture memory
- draw calls
- DOM size
- layout/reflow cost
- JavaScript execution
- animation cost

For web interfaces:

- avoid unnecessary DOM nodes
- virtualize very large lists
- lazy-load below-the-fold media
- avoid layout thrashing
- batch DOM reads/writes where necessary
- use `requestAnimationFrame` for custom visual loops
- stop animation when elements are not visible

For 3D:

- reduce draw calls
- instance repeated geometry
- use LOD
- cull invisible objects
- compress textures
- avoid excessive post-processing

---

# 49. Design-to-Code Workflow

Use this workflow for new interfaces:

```text
Requirements
    -> User Flows
    -> Information Architecture
    -> Wireframe
    -> Visual System
    -> Design Tokens
    -> Component Architecture
    -> Interaction States
    -> Responsive Rules
    -> Implementation
    -> Accessibility Review
    -> Performance Review
    -> Cross-Browser Testing
    -> Final Polish
```

Do not jump directly from a vague requirement to a large page implementation.

---

# 50. Component Architecture

Components should have:

- clear responsibility
- predictable inputs
- predictable outputs/events
- accessible semantics
- loading/error states where relevant
- responsive behavior
- testable logic
- minimal hidden side effects

Separate reusable primitives from feature-specific components.

Example hierarchy:

```text
Design Tokens
  -> Primitive Components
      -> Composite Components
          -> Feature Components
              -> Page / Screen
```

---

# 51. UX for Complex Applications

For dashboards, admin panels, agent systems, editors, builders, and automation platforms:

- Use clear information hierarchy.
- Group related controls.
- Keep primary actions visible.
- Provide keyboard shortcuts for expert workflows.
- Preserve user context during navigation.
- Use search and command palettes for large applications.
- Support undo/redo where destructive or complex editing occurs.
- Provide autosave only with clear status feedback.
- Show operation progress for long-running tasks.
- Never hide important failures behind silent notifications.

For visual builders:

- support zoom/pan
- snap/alignment guides where useful
- selection states
- multi-select
- keyboard navigation
- undo/redo
- copy/paste
- connection validation
- minimap for large canvases
- deterministic serialization

---

# 52. Data Visualization

Choose visualizations based on the data relationship.

Use appropriate forms for:

- trends
- distributions
- comparisons
- proportions
- geographic relationships
- networks
- timelines

Rules:

- Label important values.
- Do not distort scales.
- Provide accessible alternatives where necessary.
- Support responsive resizing.
- Avoid excessive animation.
- Keep legends understandable.
- Handle missing and zero values explicitly.

---

# 53. Design QA Checklist

Before release:

- [ ] Visual hierarchy is clear
- [ ] Typography is consistent
- [ ] Spacing follows tokens
- [ ] Colors follow semantic tokens
- [ ] All interactive states are implemented
- [ ] Hover/focus/active/disabled states work
- [ ] Loading states work
- [ ] Empty states work
- [ ] Error states work
- [ ] Responsive layouts work
- [ ] Keyboard navigation works
- [ ] Screen-reader labels exist where needed
- [ ] Reduced motion is supported
- [ ] Images and SVGs are optimized
- [ ] Animations do not cause jank
- [ ] 2D/3D rendering is performant
- [ ] Physics uses correct time units
- [ ] Geometry transformations are validated
- [ ] No unnecessary dependencies were added
- [ ] Production build has been tested

---

# 54. AI Design-Agent Instructions

When an AI coding agent uses this file:

1. Inspect the existing design system before creating new components.
2. Reuse existing tokens and components whenever possible.
3. Do not invent random colors, spacing, typography, shadows, or radii.
4. Preserve established visual language unless a redesign is explicitly requested.
5. Implement all meaningful UI states.
6. Make responsive behavior explicit.
7. Check accessibility before considering the UI complete.
8. Prefer CSS transforms and compositor-friendly animation for motion.
9. Measure visual performance before applying complex optimizations.
10. For 2D/3D work, separate simulation, scene state, rendering, and input logic.
11. For physics/math, use explicit units and deterministic calculations where required.
12. Do not introduce a library merely to solve a small problem that can be handled safely with existing project primitives.
13. Validate interactions, not only screenshots.
14. Test keyboard, mouse, touch, narrow screens, and reduced-motion behavior where relevant.
15. Report visual, functional, accessibility, and performance validation performed.

---

# 55. Final Design Engineering Rule

Every project should aim to be:

**Beautiful + Usable + Accessible + Responsive + Fast + Consistent + Interactive + Mathematically Correct + Physically Predictable + Maintainable.**

Design quality is not decoration. It is the combination of visual communication, interaction design, engineering correctness, performance, accessibility, and reliable behavior.
