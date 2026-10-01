'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (authError) {
      setError('Invalid email or password.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0F4C]">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-[#0C0F4C] tracking-tight">Ginga Global Group</div>
          <div className="text-sm text-gray-500 mt-1">CRM</div>
        </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#C9A227] hover:bg-[#b8911f] text-white font-semibold"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-[#C9A227] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
