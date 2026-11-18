import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import ts from 'typescript'
import { previewRuntime } from './vite.preview'

const webMcpModule = normalizePath(path.resolve(__dirname, 'src/webmcp.ts'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    previewRuntime(),
    {
      name: 'snapui-webmcp-decorators',
      enforce: 'pre',
      transform(
        code,
        id
      ) {
        if (id !== webMcpModule) return

        // Vite 8.0 does not lower standard method decorators in this module.
        const { outputText, sourceMapText } = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: {
            target: ts.ScriptTarget.ES2023,
            module: ts.ModuleKind.ESNext,
            sourceMap: true
          }
        })
        return { code: outputText, map: sourceMapText }
      }
    },
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
