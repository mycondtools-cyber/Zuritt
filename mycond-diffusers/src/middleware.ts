import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // адмінка, API, службові файли й статика (усе з крапкою в імені) — без мовного префікса
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
