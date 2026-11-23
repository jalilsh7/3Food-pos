import { useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Field, PageHeading, inputCls } from "./bits";
import { phpApi, type ManagedUser } from "@/lib/api/php-client";
import type { Role } from "@/lib/pos/model";

export const ROLE_LABEL: Record<Role, string> = {
  manager: "مدیر",
  cashier: "صندوقدار",
  kitchen: "آشپز",
};

export function UsersScreen() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ username: "", display_name: "", password: "", role: "cashier" as Role });

  async function refresh() {
    setLoading(true);
    try {
      const result = await phpApi.listUsers();
      setUsers(result.users);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "دریافت کاربران انجام نشد");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await phpApi.createUser(draft);
      setDraft({ username: "", display_name: "", password: "", role: "cashier" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت حساب انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function changeUser(user: ManagedUser, patch: Partial<Pick<ManagedUser, "role" | "is_active">>) {
    setBusy(true);
    setError("");
    try {
      await phpApi.updateUser(user.id, patch);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر حساب انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeading title="مدیریت کاربران" description="حساب‌ها، نقش‌ها و سطح دسترسی اعضای تیم را مدیریت کنید." />
      <Card>
        <h3 className="mb-3 font-semibold">ساخت حساب جدید</h3>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
          <Field label="نام کاربری"><input className={inputCls} minLength={4} maxLength={64} pattern="[A-Za-z0-9._-]+" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} required /></Field>
          <Field label="نام نمایشی"><input className={inputCls} maxLength={120} value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} required /></Field>
          <Field label="رمز اولیه (حداقل ۱۲ نویسه)"><input className={inputCls} type="password" minLength={12} maxLength={200} autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required /></Field>
          <Field label="نقش"><select className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}><option value="cashier">صندوقدار</option><option value="kitchen">آشپز</option><option value="manager">مدیر</option></select></Field>
          <div className="sm:col-span-2"><Btn type="submit" disabled={busy}>{busy ? "در حال ذخیره..." : "ساخت حساب"}</Btn></div>
        </form>
      </Card>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">در حال دریافت کاربران...</p> : users.map((user) => (
        <Card key={user.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{user.display_name} — {user.username}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]} · {user.is_active ? "فعال" : "غیرفعال"}{user.must_change_password ? " · نیازمند تغییر رمز" : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={inputCls} aria-label="نقش کاربر" value={user.role} disabled={busy} onChange={(e) => void changeUser(user, { role: e.target.value as Role })}>
                <option value="cashier">صندوقدار</option><option value="kitchen">آشپز</option><option value="manager">مدیر</option>
              </select>
              <Btn tone="ghost" disabled={busy} onClick={() => void changeUser(user, { is_active: !user.is_active })}>{user.is_active ? "غیرفعال‌کردن" : "فعال‌کردن"}</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
