import { test, expect } from '@playwright/test';

// T028 — E2E Dashboard Tests
// These tests verify the dashboard pages render correctly.

test.describe('Dashboard', () => {
  test('should load the pipeline status page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/pipeline/i)).toBeVisible();
  });

  test('should show the Run Pipeline button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /run pipeline/i })).toBeVisible();
  });

  test('should navigate to QA Scores page', async ({ page }) => {
    await page.goto('/');
    await page.getByText(/qa scores/i).click();
    await expect(page.getByText(/qa scores/i)).toBeVisible();
  });

  test('should navigate to Publish History page', async ({ page }) => {
    await page.goto('/');
    await page.getByText(/publish history/i).click();
    await expect(page.getByText(/publish history/i)).toBeVisible();
  });

  test('should display circuit breaker status', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/circuit breaker/i)).toBeVisible();
  });
});
