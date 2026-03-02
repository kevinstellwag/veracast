import type { Metadata } from 'next'
import { Playfair_Display, Sora, DM_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif', weight: ['700', '900'] })
const sora = Sora({ subsets: ['latin'], variable: '--font-sans', weight: ['300', '400', '500', '600', '700'] })
const mono = DM_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'Veracast — Post it. Prove it. Spread it.',
  description: 'The social platform where every factual claim needs a source. News, opinions, and discussions — verified.',
  openGraph: {
    title: 'Veracast',
    description: 'Post it. Prove it. Spread it.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${sora.variable} ${mono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
