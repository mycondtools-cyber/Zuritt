"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card w-full max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-extrabold">Адмін-панель</h1>
      <label className="block">
        <span className="label">Пароль</span>
        <input className="input" type="password" name="password" autoFocus required autoComplete="current-password" />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Вхід…" : "Увійти"}
      </button>
    </form>
  );
}
