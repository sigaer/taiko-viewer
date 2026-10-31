import type {ApiReadVersions} from '@sakura-taiko/contract';
import type {GrowthHistoryResponse,GrowthFact} from './player-growth';
import type {PlayerGoal} from './player-goal';
/** Private BFF summary, using the sole Contract and existing Growth types. */
export type MyTaikoOverview={
 release:ApiReadVersions&{catalogRevisionProfile:'developer-api-v1-source-bytes';legacyCatalogRevision:string;bindingSource:string};
 profile:{username:string;bindingId:string;taikoId:string;currentTitle:string|null;bindings:{bindingId:string;label:string;isCurrent:boolean}[]};
 scores:{rows:number;scored:number;cleared:number;clearUnknown:number;highestScore:number|null};
 activeGoal:(Pick<PlayerGoal,'songId'|'difficultyType'|'title'|'goalType'>&{available:boolean})|null;
 growth:{range:GrowthHistoryResponse['range'];coverage:GrowthHistoryResponse['coverage'];totalFacts:number;counts:Partial<Record<GrowthFact['type'],number>>;recentFacts:GrowthFact[];recentFactsLimit:8;hasMoreFacts:boolean};
 recommendation:{href:'/tools/recommend';state:'ENTRY_ONLY';bindingId:string;scoreRevision:string};
 diagnostics:{physicalCurrentReads:number;measurements:'NOT_REQUESTED';historyMeaning:'CANONICAL_FACTS_NOT_SYNCHRONIZATION_PLAY_EVENTS'};
};
