import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loader } from '@monaco-editor/react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// 配置 Monaco Editor 始终从本地静态资源加载，彻底杜绝外网 CDN 延迟与白屏
loader.config({
  paths: {
    vs: typeof window !== 'undefined' && window.location.protocol === 'file:' ? './vs' : '/vs',
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)


