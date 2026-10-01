"use client"

import { useState } from "react"
import { toast } from "sonner"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ShieldCheckIcon, ShieldOffIcon, MailIcon } from "lucide-react"

type EnrollState =
  | { step: "idle" }
  | {
      step: "qr"
      qrCode: string
      secret: string
      factorId: string
    }
  | { step: "verify"; factorId: string }

export function AccountShell({
  email,
  fullName,
  role,
  hasMfa,
  mfaFactorId,
}: {
  email: string
  fullName: string
  role: string
  hasMfa: boolean
  mfaFactorId: string | null
}) {
  const [mfaState, setMfaState] = useState<EnrollState>({ step: "idle" })
  const [verifyCode, setVerifyCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mfaEnrolled, setMfaEnrolled] = useState(hasMfa)
  const [currentFactorId, setCurrentFactorId] = useState(mfaFactorId)

  const supabase = createClient()

  async function sendResetEmail() {
    setIsLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setIsLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Password reset email sent - check your inbox")
    }
  }

  async function startEnroll() {
    setIsLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    })
    setIsLoading(false)
    if (error || !data) {
      toast.error(error?.message ?? "Failed to start MFA enrolment")
      return
    }
    setMfaState({
      step: "qr",
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      factorId: data.id,
    })
  }

  async function verifyEnroll() {
    if (mfaState.step !== "qr" && mfaState.step !== "verify") return
    const factorId = mfaState.factorId
    setIsLoading(true)
    const { data: challengeData, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challengeData) {
      setIsLoading(false)
      toast.error(challengeErr?.message ?? "Challenge failed")
      return
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    })
    setIsLoading(false)
    if (verifyErr) {
      toast.error(verifyErr.message)
    } else {
      toast.success("MFA enabled")
      setMfaEnrolled(true)
      setCurrentFactorId(factorId)
      setMfaState({ step: "idle" })
      setVerifyCode("")
    }
  }

  async function unenrol() {
    if (!currentFactorId) return
    setIsLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: currentFactorId })
    setIsLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("MFA removed")
      setMfaEnrolled(false)
      setCurrentFactorId(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0C0F4C]">My account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your personal settings and security.
        </p>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your current account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{fullName || "-"}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{email}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge
              className={
                role === "admin"
                  ? "bg-[#C9A227]/20 text-[#C9A227]"
                  : "bg-blue-100 text-blue-700"
              }
            >
              {role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Send a password reset link to your email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={sendResetEmail}
            disabled={isLoading}
            className="gap-1.5"
          >
            <MailIcon className="size-3.5" />
            Send reset email
          </Button>
        </CardContent>
      </Card>

      {/* MFA */}
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Add extra security to your account using an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaEnrolled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheckIcon className="size-4 text-green-600" />
                <span className="text-green-700 font-medium">MFA enabled</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={unenrol}
                disabled={isLoading}
                className="gap-1.5"
              >
                <ShieldOffIcon className="size-3.5" />
                Remove MFA
              </Button>
            </div>
          ) : mfaState.step === "idle" ? (
            <Button
              variant="outline"
              onClick={startEnroll}
              disabled={isLoading}
              className="gap-1.5"
            >
              <ShieldCheckIcon className="size-3.5" />
              Enrol TOTP authenticator
            </Button>
          ) : mfaState.step === "qr" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (e.g. Google
                Authenticator, Authy), then enter the 6-digit code below.
              </p>
              <div className="flex flex-col items-start gap-3">
                <Image
                  src={mfaState.qrCode}
                  alt="MFA QR code"
                  width={180}
                  height={180}
                  className="rounded-lg border"
                  unoptimized
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Can&apos;t scan? Enter this key manually:
                  </p>
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {mfaState.secret}
                  </code>
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="mfa_code">Verification code</Label>
                <Input
                  id="mfa_code"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={verifyEnroll}
                    disabled={isLoading || verifyCode.length < 6}
                  >
                    {isLoading ? "Verifying..." : "Verify and enable"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMfaState({ step: "idle" })}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
