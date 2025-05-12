import { defineConfig, coverageConfigDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [],

  build: {
    lib: {
      entry: ['src/index.ts'],
    },
    rollupOptions: {
      output: [
        {
          format: 'es',
          inlineDynamicImports: false,
          preserveModules: true,
        },
        {
          format: 'umd',
          name: 'TonCellParser',
          globals: { '@ton/core': 'TON' },

        }
      ],
      external: ['@ton/core'],
    },
    minify: false,
  },

  test: {
    globals: true,
    include: [
      'tests/**/*.test.(c|m)?[tj]s',
    ],
    coverage: {
      exclude: [...coverageConfigDefaults.exclude, 'src/index.ts'],
    }
  },
})
