export default {
  project: './project.inlang',
  outdir: './src/paraglide',
  emitTsDeclarations: true,
  outputStructure: 'message-modules',
  // Routes and API calls pass their locale explicitly; no cookies or browser detection.
  strategy: ['baseLocale'],
};
