import {defineConfig} from '@sanity/pkg-utils'
import {visualizer} from 'rollup-plugin-visualizer'

import {name, version} from './package.json'

export default defineConfig({
  extract: {
    rules: {
      'ae-missing-release-tag': 'off',
      'tsdoc-undefined-tag': 'off',
    },
  },

  bundles: [
    {
      source: './src/default.ts',
      import: './dist/default.js',
      runtime: 'browser',
    },
    {
      source: './src/node.ts',
      import: './dist/node.js',
      runtime: 'node',
    },
  ],

  rollup: {
    plugins: [
      visualizer({
        emitFile: true,
        filename: 'stats.html',
        gzipSize: true,
        title: `${name}@${version} bundle analysis`,
      }),
    ],
  },

  tsconfig: 'tsconfig.dist.json',
})
