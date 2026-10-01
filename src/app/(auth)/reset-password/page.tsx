'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: data.password })
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0F4C]">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-[#0C0F4C] tracking-tight">Ginga Global Group</div>
          <div className="text-sm text-gray-500 mt-1">Set new password</div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register('confirm')}
            />
            {errors.confirm && (
              <p className="text-sm text-red-500">{errors.confirm.message}</p>
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
            {isSubmitting ? 'Updating...' : 'Set new password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
