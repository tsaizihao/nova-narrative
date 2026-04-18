export type ReaderLayoutMode = 'desktop' | 'mobile';
export type ReviewSectionId = 'canon' | 'characters' | 'worldbook' | 'rules';

export const READER_MOBILE_BREAKPOINT = 768;

export const REVIEW_SECTIONS = [
  { id: 'canon', label: '原著内核', eyebrow: 'Canon' },
  { id: 'characters', label: '角色', eyebrow: 'Characters' },
  { id: 'worldbook', label: '世界书', eyebrow: 'Worldbook' },
  { id: 'rules', label: '规则', eyebrow: 'Rules' }
] as const satisfies ReadonlyArray<{
  id: ReviewSectionId;
  label: string;
  eyebrow: string;
}>;

export function resolveReaderLayoutMode(width: number): ReaderLayoutMode {
  return width < READER_MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}
