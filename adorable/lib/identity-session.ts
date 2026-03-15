/**
 * Local identity session.
 * In local mode there's no multi-user auth — we use a fixed local identity.
 */

const LOCAL_IDENTITY_ID = "local-user";

export const VOXEL_IDENTITY_COOKIE = "voxel_identity_id";

export const getOrCreateIdentitySession = async () => {
  return {
    identityId: LOCAL_IDENTITY_ID,
  };
};
