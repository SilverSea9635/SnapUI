import { createHash } from 'node:crypto'
import path from 'node:path'
import { build, type Plugin } from 'vite'

const moduleId = 'virtual:snapui-preview-runtime'
const resolvedId = `\0${moduleId}`

// A classic, self-contained script lets the opaque-origin frame boot without
// CORS, remote dependencies, or access to the application's module graph.
export function previewRuntime(): Plugin {
  return {
    name: 'snapui-preview-runtime',
    resolveId(id) {
      if (id === moduleId) return resolvedId
    },
    async load(id) {
      if (id !== resolvedId) return

      const output = await build({
        configFile: false,
        mode: 'production',
        logLevel: 'error',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        oxc: { jsx: { runtime: 'automatic', development: false } },
        build: {
          lib: {
            entry: path.resolve(__dirname, 'src/components/Preview/previewRuntime.tsx'),
            name: 'SnapUIPreview',
            formats: ['iife'],
          },
          write: false,
          minify: true,
        },
      })
      const bundle = Array.isArray(output) ? output[0] : output
      const entry = 'output' in bundle && bundle.output.find((item) => item.type === 'chunk' && item.isEntry)
      if (!entry || entry.type !== 'chunk') throw new Error('Could not build the SnapUI preview runtime')

      for (const file of Object.keys(entry.modules)) {
        if (path.isAbsolute(file)) this.addWatchFile(file)
      }

      const script = entry.code.replace(/<\/script/gi, '<\\/script')
      const hash = createHash('sha256').update(script).digest('base64')
      return `export const script = ${JSON.stringify(script)}; export const hash = ${JSON.stringify(hash)};`
    },
  }
}
