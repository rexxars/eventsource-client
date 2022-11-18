import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  minify: false,
  runtime: 'node',
  exports: (defaults) => {
    return {
      ...defaults,
      '.': {
        ...defaults['.'],
      },
      './node': {
        source: './src/node/index.ts',
        import: './dist/index.node.js',
        require: './dist/index.node.cjs',
        default: './dist/index.node.cjs',
      },
    }
  },
})
