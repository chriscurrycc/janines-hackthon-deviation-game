import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Deviation Game · 骗过 AI',
  description: '人机斗智你画我猜：画得人懂、AI 不懂，你就赢了。',
  icons: { icon: '/pencil.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* Google Fonts are unreachable in mainland China without a VPN. Load them
            non-blocking (media=print) and flip to all on window load, so the page
            renders instantly on system fonts either way. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=ZCOOL+KuaiLe&display=swap"
          media="print"
          data-async-font=""
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `addEventListener('load',function(){document.querySelectorAll('link[data-async-font]').forEach(function(l){l.media='all'})})`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
