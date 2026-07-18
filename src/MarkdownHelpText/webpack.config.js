// pcf-scripts custom webpack hook (requires "pcfAllowCustomWebpack": "on" in featureconfig.json).
// Lets TestModeData.ts `import` markdown-test.md directly as raw text, via webpack 5's built-in
// asset/source module type - no extra loader dependency needed. Dev-tooling only, has no effect
// on anything shipped to Dataverse other than the bundled test-mode sample text.
module.exports = {
  module: {
    rules: [
      {
        test: /\.md$/i,
        type: "asset/source",
      },
    ],
  },
};
