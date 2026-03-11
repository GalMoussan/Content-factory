import { test, expect } from '@playwright/test';

// T028 — E2E Pipeline Run Test
// Simulates triggering a pipeline run and checking results.
// Requires the server to be running with mocked external APIs.

test.describe('Pipeline Run', () => {
  test('should trigger pipeline via the dashboard', async ({ page }) => {
    await page.goto('/');

    const triggerButton = page.getByRole('button', { name: /run pipeline/i });
    await expect(triggerButton).toBeVisible();
    await expect(triggerButton).toBeEnabled();

    // Trigger the pipeline
    await triggerButton.click();

    // After triggering, the button should become disabled (pipeline running)
    await expect(triggerButton).toBeDisabled();
  });

  test('should show health endpoint is responding', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('should return pipeline status from API', async ({ request }) => {
    const response = await request.get('/api/pipeline/status');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('should return QA scores from API', async ({ request }) => {
    const response = await request.get('/api/qa/scores');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('should return publish history from API', async ({ request }) => {
    const response = await request.get('/api/publish/history');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});
