import type { Metadata } from 'next'
import { DM_Sans, Poppins } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const poppins = Poppins({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ginga Global Group CRM',
  description: 'Internal CRM for Ginga Global Group',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
