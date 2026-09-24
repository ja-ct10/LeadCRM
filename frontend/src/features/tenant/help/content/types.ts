export interface HelpSection {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
}

export interface HelpArticle {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  keywords: string[];
  sections: HelpSection[];
  notes: string[];
  related: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  sources: string[];
}

/** Keep copy in content modules; render plain text, never executable HTML. */
export function articleFactory(category: string) {
  return (slug: string, title: string, summary: string, sections: HelpSection[],
    options: { notes?: string[]; related?: string[]; keywords?: string[] } = {}): HelpArticle => ({
    id: slug, slug, category, title, summary, sections,
    notes: options.notes ?? [], related: options.related ?? [], keywords: options.keywords ?? [],
  });
}

export const steps = (...items: string[]): HelpSection => ({ heading: 'Steps', steps: items });
export const details = (heading: string, ...items: string[]): HelpSection => ({ heading, bullets: items });
