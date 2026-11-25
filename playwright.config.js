import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the fixture build (fake, fully filled clinic
// details) so every button and the booking flow can be exercised.
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4174/',
    trace: 'off'
  },
  webServer: {
    command: 'npx vite preview --outDir dist-fixture --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { args: gl } } },
    { name: 'phone', use: { ...devices['Pixel 7'], launchOptions: { args: gl } } }
  ]
});
