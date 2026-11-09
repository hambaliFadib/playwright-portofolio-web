module.exports = Object.freeze({
  framework: Object.freeze({
    repository: 'https://github.com/hambaliFadib/playwright-quality-framework',
    sha: 'b5b46cc60b834ffe5ae0fcfc38d8d87921bd490d',
  }),
  application: Object.freeze({
    repository: 'https://github.com/hambaliFadib/portofolio-web',
    ref: 'feature/portfolio-simplification-v1',
    sha: 'b3ceb744b28e9d328687f656688fdff0ff0152f6',
    unitModule: 'lib/date-ranges.ts',
  }),
  suites: Object.freeze(['unit', 'http-smoke', 'ui-e2e']),
});
