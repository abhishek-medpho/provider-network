import {
  getWhatsAppFormState,
  getEmailFormState,
  saveWhatsAppConfig,
  saveEmailConfig,
  testWhatsApp,
  testEmail,
} from "@/lib/actions/settings";
import { SECRET_UNCHANGED } from "@/lib/channels/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Settings as SettingsIcon } from "lucide-react";
import { TestChannel } from "./_components/TestChannel";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [wa, email] = await Promise.all([
    getWhatsAppFormState(),
    getEmailFormState(),
  ]);

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <header className="flex items-center gap-2">
        <SettingsIcon className="size-5 text-muted-foreground" />
        <div>
          <h1>Settings</h1>
          <p className="text-sm text-muted-foreground">
            Channel credentials. Values saved here take precedence over
            <code className="font-mono text-xs px-1 py-0.5 bg-muted rounded mx-1">
              .env
            </code>
            on subsequent boots.
          </p>
        </div>
      </header>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="size-4 text-success" />
                WhatsApp (Ultramsg)
              </CardTitle>
              <CardDescription>
                Used by every campaign invite + reminder + admin magic link.
              </CardDescription>
            </div>
            <SourceBadge source={wa.configuredVia} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={saveWhatsAppConfig} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="enabled" id="wa-enabled" defaultChecked={wa.enabled} />
              <span>Channel enabled</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Instance ID"
                name="instanceId"
                defaultValue={wa.instanceId}
                placeholder="instance93870"
                required
              />
              <SecretField
                label="Token"
                name="token"
                hasExisting={!!wa.tokenMasked}
                placeholder="Paste Ultramsg token"
                masked={wa.tokenMasked}
                help="Find in Ultramsg dashboard → Instance → Token."
              />
              <Field
                label="Base URL"
                name="baseUrl"
                defaultValue={wa.baseUrl}
              />
              <Field
                label="Default country code"
                name="defaultCountryCode"
                defaultValue={wa.defaultCountryCode}
                placeholder="91"
                help="Prepended when CSV phones lack a country code."
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save WhatsApp settings</Button>
            </div>
          </form>

          <hr className="my-5 border-border" />

          <TestChannel
            channel="WHATSAPP"
            action={testWhatsApp}
            placeholder="919876543210"
            help="Number in E.164 (digits only, no +)."
          />
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="size-4 text-foreground/80" />
                Email (Gmail SMTP)
              </CardTitle>
              <CardDescription>
                Used when a campaign&apos;s channel strategy includes Email.
              </CardDescription>
            </div>
            <SourceBadge source={email.configuredVia} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={saveEmailConfig} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="enabled" id="email-enabled" defaultChecked={email.enabled} />
              <span>Channel enabled</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Gmail address"
                name="gmailUser"
                type="email"
                defaultValue={email.gmailUser}
                placeholder="hello@labstack.in"
                required
              />
              <SecretField
                label="App password"
                name="gmailAppPassword"
                hasExisting={!!email.gmailAppPasswordMasked}
                placeholder="16-char password from Google"
                masked={email.gmailAppPasswordMasked}
                help={
                  <>
                    Enable 2FA →{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      generate an app password
                    </a>
                    .
                  </>
                }
              />
              <Field
                label="From name"
                name="fromName"
                defaultValue={email.fromName}
                placeholder="Labstack Network"
              />
              <Field
                label="Reply-To"
                name="replyTo"
                type="email"
                defaultValue={email.replyTo}
                placeholder="hello@labstack.in"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save Email settings</Button>
            </div>
          </form>

          <hr className="my-5 border-border" />

          <TestChannel
            channel="EMAIL"
            action={testEmail}
            placeholder="you@example.com"
            help="Sends a test email immediately. Open tracking + click tracking are included if APP_BASE_URL is set."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SMS</CardTitle>
          <CardDescription>
            Not wired up yet. The sender abstraction has a slot for SMS — a
            future PR will add a Twilio / MSG91 adapter and surface its
            settings here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// --------------- atoms ---------------

function SourceBadge({ source }: { source: "db" | "env" | "none" }) {
  if (source === "db")
    return (
      <Badge variant="secondary" className="text-[10px]">
        From database
      </Badge>
    );
  if (source === "env")
    return (
      <Badge variant="outline" className="text-[10px]">
        From .env (legacy)
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
      Not configured
    </Badge>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
  help,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  help?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

/**
 * Sensitive credential input. If a value is already saved we show the mask
 * as a placeholder + a sentinel default value (`SECRET_UNCHANGED`). The save
 * action treats the sentinel as "keep existing", so the admin only has to
 * re-type the secret when they want to rotate it.
 */
function SecretField({
  label,
  name,
  hasExisting,
  placeholder,
  masked,
  help,
}: {
  label: string;
  name: string;
  hasExisting: boolean;
  placeholder?: string;
  masked: string;
  help?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        <span className="text-destructive ml-0.5">*</span>
      </Label>
      <Input
        id={name}
        name={name}
        type="password"
        defaultValue={hasExisting ? SECRET_UNCHANGED : ""}
        placeholder={hasExisting ? masked : placeholder}
        autoComplete="new-password"
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
