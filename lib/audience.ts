import { cookies } from "next/headers";

import {
  AUDIENCE_COOKIE,
  DEFAULT_AUDIENCE,
  isAudience,
  type Audience,
} from "./audience-shared";

/** Læser audience-valget server-side, så siden kan renderes rigtigt straks. */
export async function getAudience(): Promise<Audience> {
  const store = await cookies();
  const value = store.get(AUDIENCE_COOKIE)?.value;
  return isAudience(value) ? value : DEFAULT_AUDIENCE;
}
