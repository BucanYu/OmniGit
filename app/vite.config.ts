import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, type Plugin } from 'vite'
import { handleGitApiRequest } from './src/server/gitApiHandler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function gitApiPlugin(): Plugin {
  return {
    name: 'git-api-middleware',
    configureServer(server) {
      // 监听后端服务代码 (src/server/**)，在修改时自动重启 Vite 服务器以重新加载后端中间件
      const serverDir = path.resolve(__dirname, 'src/server')
      server.watcher.add(serverDir)
      const onServerFileChange = (file: string) => {
        if (file.startsWith(serverDir) || file.includes('src/server') || file.includes('src\\server')) {
          console.log('\x1b[36m%s\x1b[0m', `[OmniGit] Detected backend file change (${path.basename(file)}), auto-restarting server...`)
          server.restart()
        }
      }
      server.watcher.on('change', onServerFileChange)
      server.watcher.on('add', onServerFileChange)
      server.watcher.on('unlink', onServerFileChange)

      server.middlewares.use(async (req, res, next) => {
        const handled = await handleGitApiRequest(req, res)
        if (!handled) {
          next()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gitApiPlugin()],
  server: {
    port: 5345,
    strictPort: true,
    host: '0.0.0.0',
  },
})
