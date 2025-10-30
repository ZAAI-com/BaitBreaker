// webpack.config.js
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: {
    'background': './src/background/service-worker.js',
    'content': './src/content/content-script.js',
    'popup': './src/popup/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js'
  },
  experiments: { topLevelAwait: true },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } }
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());
            // Update service worker path
            if (manifest.background && manifest.background.service_worker) {
              manifest.background.service_worker = 'background.bundle.js';
            }
            // Update content script path
            if (manifest.content_scripts && manifest.content_scripts[0]) {
              manifest.content_scripts[0].js = ['content.bundle.js'];
              // Fix CSS path
              if (manifest.content_scripts[0].css) {
                manifest.content_scripts[0].css = manifest.content_scripts[0].css.map(
                  cssPath => cssPath.replace('src/styles/', 'styles/')
                );
              }
            }
            // Update popup path
            if (manifest.action && manifest.action.default_popup) {
              manifest.action.default_popup = 'popup.html';
            }
            return JSON.stringify(manifest, null, 2);
          }
        },
        { from: 'icons', to: 'icons' },
        { from: 'src/styles', to: 'styles' },
        {
          from: 'src/popup/popup.html',
          transform(content) {
            return content.toString()
              .replace('type="module" src="popup.js"', 'src="popup.bundle.js"')
              .replace('src="popup.js"', 'src="popup.bundle.js"');
          }
        },
        { from: 'src/popup/popup.css' }
      ]
    })
  ]
};
