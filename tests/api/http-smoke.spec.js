const { test, expect } = require('../../src/fixtures/test.fixture');

test('GET / serves the pinned portfolio homepage HTML', async ({ request }) => {
  const response = await request.get('/');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');

  const html = await response.text();
  expect(html).toContain('<title>Hambali Fadib — Software Quality Assurance Engineer</title>');
  expect(html).toContain('name="description"');
});