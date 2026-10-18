/** Release-controlled Contract 1.1 candidate state; not frozen until a new explicit release decision. */
export const contractRelease: ({status:'FREEZE_CANDIDATE';contractFrozen:false}|{status:'CONTRACT_FROZEN';contractFrozen:true}) = {
 status:'FREEZE_CANDIDATE',contractFrozen:false
};
