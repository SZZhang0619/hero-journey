# HeroJourney

This project uses Angular Standalone with Server-Side Rendering (SSR), zoneless change detection, and client hydration.

## Prerequisites
- Node.js ^20.19.0 (recommended: 20 LTS)

## Development server
Start the dev server (with hydration and HMR):
```bash
ng serve
```
Then open http://localhost:4200/.

## Building
Build a production SSR bundle:
```bash
ng build
```
Artifacts are emitted to:
- dist/hero-journey/browser (client)
- dist/hero-journey/server (server)

## Run production SSR
After building:
```bash
npm run serve:ssr:hero-journey
# -> Node Express server listening on http://localhost:4000
```

## Running unit tests
Run Karma/Jasmine tests:
```bash
ng test
```

## Project structure highlights
- src/main.ts
  - Client bootstrap via bootstrapApplication(App, appConfig).
- src/main.server.ts
  - Server bootstrap for SSR.
- src/server.ts
  - Express integration for SSR runtime (dev/build handler and prod server).
- src/app/app.config.ts
  - Zoneless app with provideZonelessChangeDetection and provideClientHydration(withEventReplay()).
- src/app/app.config.server.ts + src/app/app.routes.server.ts
  - Server providers and prerender routes (RenderMode.Prerender).
- src/index.html
  - Root host element <app-root>.
- angular.json
  - Application builder with outputMode: "server" and ssr.entry pointing to src/server.ts.
- tsconfig*.json
  - Strict TypeScript settings for app/spec.
- public/
  - Static assets are served from this folder.

## Code scaffolding
```bash
ng generate component component-name
# for more:
ng generate --help
```

## End-to-end tests
```bash
ng e2e
```
Angular CLI does not include an e2e framework by default; choose one as needed.

## Additional Resources
- Angular CLI Overview and Command Reference: https://angular.dev/tools/cli
