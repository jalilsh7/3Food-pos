import { useState, type FormEvent, type ReactNode } from "react";
import { Card, Field, inputCls } from "./bits";
import { phpApi, type ApiUser } from "@/lib/api/php-client";
import { useAppearance } from "@/lib/appearance";

export function AuthFrame({ children }: { children: ReactNode }) {
 const {settings:appearance}=useAppearance();
 return <div className="pos-auth-shell grid min-h-screen place-items-center bg-bg p-4"><Card className="pos-auth-card w-full max-w-md">{appearance.logoUrl?<img src={appearance.logoUrl} alt="لوگوی فروشگاه" className="mx-auto mb-3 h-16 max-w-40 object-contain"/>:null}{children}</Card></div>;
}

export function PhpLoginScreen({ setupRequired, onAuthenticated }: { setupRequired: boolean; onAuthenticated: (user: ApiUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("مدیر");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = setupRequired
        ? await phpApi.setupManager({ username, password, display_name: displayName, setupToken })
        : await phpApi.login(username, password);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={(event) => void submit(event)} className="w-full min-w-[min(84vw,360px)] space-y-3">
        <h1 className="text-xl font-bold">{setupRequired ? "راه‌اندازی مدیر اصلی" : "ورود به صندوق"}</h1>
        {setupRequired ? <>
          <Field label="نام نمایشی"><input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></Field>
          <Field label="توکن یک‌بارمصرف راه‌اندازی"><input className={inputCls} type="password" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} required autoComplete="off" /></Field>
        </> : null}
        <Field label="نام کاربری"><input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></Field>
        <Field label="رمز عبور"><input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setupRequired ? "new-password" : "current-password"} minLength={setupRequired ? 12 : undefined} required /></Field>
        {error ? <p className="text-sm text-warn">{error}</p> : null}
        <button disabled={busy} className="w-full rounded-xl bg-ink px-4 py-3 font-semibold text-bg disabled:opacity-50">{busy ? "در حال انجام..." : setupRequired ? "ساخت مدیر" : "ورود امن"}</button>
      </form>
    </AuthFrame>
  );
}

export function ChangePasswordScreen({ user, onChanged }: { user: ApiUser; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await phpApi.changePassword(current, next);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر رمز انجام نشد");
    } finally {
      setBusy(false);
    }
  }
  return <AuthFrame><form onSubmit={(event) => void submit(event)} className="w-full min-w-[min(84vw,360px)] space-y-3">
    <h1 className="text-xl font-bold">تغییر رمز عبور</h1>
    <p className="text-sm text-muted">{user.display_name}، پیش از ادامه باید رمز خود را تغییر دهید.</p>
    <Field label="رمز فعلی"><input className={inputCls} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
    <Field label="رمز جدید (حداقل ۱۲ نویسه)"><input className={inputCls} type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={12} required /></Field>
    {error ? <p className="text-sm text-warn">{error}</p> : null}
    <button disabled={busy} className="w-full rounded-xl bg-ink px-4 py-3 font-semibold text-bg disabled:opacity-50">{busy ? "در حال ذخیره..." : "ذخیره رمز جدید"}</button>
  </form></AuthFrame>;
}
