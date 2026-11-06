export type TjaChart = {
  course: string;
  branch: string;
  totalNotes: number;
  error?: string;
  constants?: Record<'sub_constant_1' | 'main_constant' | 'sub_constant_2' | 'stamina' | 'handspeed' | 'burst' | 'complex' | 'rhythm', number>;
  raw?: Record<string, number>;
};
export type TjaResult = {
  title: string;
  encoding: string;
  model: string;
  calibrationSha256: string;
  charts: TjaChart[];
};
