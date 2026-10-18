import { LoginForm } from "./form";

export const metadata = { title: "Вхід в адмінку" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
