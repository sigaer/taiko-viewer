import { getTaikoPython } from "../../utils/taiko-python.ts";

/** Deployment/internal configuration only; never selected from request data. */
export function getPublicationPython(override?: string) {
  return getTaikoPython(override);
}
