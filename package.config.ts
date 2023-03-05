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

  legacyExports: true,

  bundles: [
    {
      source: './src/default.ts',
      require: './dist/default.js',
      runtime: 'browser',
    },
    {
      source: './src/node.ts',
      require: './dist/node.js',
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
