import {
  centreProfileSchema,
  type CentreProfile,
} from '../centres/profile-schema';
import { centreProfiles } from '../centres/registry';

export { centreProfileSchema, type CentreProfile };

// Reviewed metadata lives in data/centres/*.json. No request-time geocoding or inference.
export const verifiedCentreProfiles = centreProfiles;

export function centreProfile(institutionId: string): CentreProfile {
  return centreProfileSchema.parse(
    verifiedCentreProfiles[institutionId] ?? {
      slug: institutionId.replace(/^cc-/, ''),
    },
  );
}
