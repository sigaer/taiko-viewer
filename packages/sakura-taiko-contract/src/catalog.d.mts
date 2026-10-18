import type {Song,Chart,CatalogSongWithCharts} from './index.ts';
export function difficultyToTjaCourse(difficulty:number):number;
export function projectCatalog(rows:unknown,revision:string,aliasRows?:unknown):{songs:Song[];charts:Chart[]};
export function catalogSongsWithCharts(projected:{songs:Song[];charts:Chart[]}):CatalogSongWithCharts[];
