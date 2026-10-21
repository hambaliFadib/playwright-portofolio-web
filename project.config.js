module.exports = Object.freeze({
  framework: Object.freeze({
    repository: 'https://github.com/hambaliFadib/playwright-quality-framework',
    sha: 'b5b46cc60b834ffe5ae0fcfc38d8d87921bd490d',
  }),
  application: Object.freeze({
    repository: 'https://github.com/hambaliFadib/portofolio-web',
    ref: 'dev',
    sha: '5915098e2aa507a451f58e70547abded3023f8d9',
    unitModule: 'lib/date-ranges.ts',
  }),
  suites: Object.freeze(['unit', 'http-smoke', 'ui-e2e']),
});