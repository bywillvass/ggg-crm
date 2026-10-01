'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0F4C]">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-[#0C0F4C] tracking-tight">Ginga Global Group</div>
          <div className="text-sm text-gray-500 mt-1">Reset password</div>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Check your email for a password reset link.
            </p>
            <Link href="/login" className="text-sm text-[#C9A227] hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#C9A227] hover:bg-[#b8911f] text-white font-semibold"
              >
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm text-[#C9A227] hover:underline">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
