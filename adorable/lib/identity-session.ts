import { cookies } from "next/headers";
import { freestyle } from "freestyle-sandboxes";

export const ADORABLE_IDENTITY_COOKIE = "adorable_identity_id";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const isIdentityValid = async (identityId: string): Promise<boolean> => {
  try {
    const identity = freestyle.identities.ref({ identityId });
    await identity.permissions.git.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
};

export const getOrCreateIdentitySession = async () => {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ADORABLE_IDENTITY_COOKIE)?.value;

  if (existing && (await isIdentityValid(existing))) {
    return {
      identityId: existing,
      identity: freestyle.identities.ref({ identityId: existing }),
    };
  }

  const { identityId, identity } = await freestyle.identities.create({});

  cookieStore.set(ADORABLE_IDENTITY_COOKIE, identityId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
  });

  return { identityId, identity };
};
