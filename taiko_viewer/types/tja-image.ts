export type TjaImageCourse = { index: number; course: string; side: string; level: number };
export type TjaImageInfo = { title: string; courses: TjaImageCourse[] };
export type TjaImageResult = { blob: Blob; width: number; height: number; bytes: number; title: string };
