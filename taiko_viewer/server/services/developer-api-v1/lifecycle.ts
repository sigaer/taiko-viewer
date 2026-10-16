/** Release-controlled contract decision, independent of the runtime feature gate.
 * A future signed release updates this record and its evidence; no environment toggle freezes it.
 */
export const contractRelease: ({status:'FREEZE_CANDIDATE';contractFrozen:false}|{status:'CONTRACT_FROZEN';contractFrozen:true}) = {
 status:'FREEZE_CANDIDATE',contractFrozen:false
};
