/** Release-controlled contract decision, independent of the runtime feature gate.
 * Owner chat approval CHAT_OWNER_APPROVAL_20261016_F1_F5 controls this record; no environment toggle freezes it.
 */
export const contractRelease: ({status:'FREEZE_CANDIDATE';contractFrozen:false}|{status:'CONTRACT_FROZEN';contractFrozen:true}) = {
 status:'CONTRACT_FROZEN',contractFrozen:true
};
