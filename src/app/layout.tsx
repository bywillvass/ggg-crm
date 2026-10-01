import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ginga Global Group CRM',
  description: 'Internal CRM for Ginga Global Group',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <head>
        {/* TODO: Add Adobe Fonts typekit kit URL here once Will sets it up - see PROGRESS.md */}
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
