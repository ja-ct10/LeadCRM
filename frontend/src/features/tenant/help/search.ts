import { helpArticles, getCategory } from './content';

const wordForms: Record<string, string> = {
  creating: 'create', creation: 'create', created: 'create',
  editing: 'edit', edited: 'edit', managing: 'manage', management: 'manage',
  assigning: 'assign', assigned: 'assign', importing: 'import',
  scheduling: 'schedule', scheduled: 'schedule', converting: 'convert',
  archiving: 'archive', archived: 'archive', restoring: 'restore',
  sending: 'send', sent: 'send', permissions: 'permission',
  roles: 'role', leads: 'lead', contacts: 'contact', accounts: 'account',
  deals: 'deal', campaigns: 'campaign', workflows: 'workflow', tasks: 'task',
  templates: 'template', settings: 'setting', fields: 'field', users: 'user',
};
function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean).map(word => wordForms[word] ?? word).join(' ');
}

const index = helpArticles.map(article => ({
  article,
  title: normalize(article.title),
  category: normalize(getCategory(article.category)?.title ?? ''),
  keywords: normalize(article.keywords.join(' ')),
  summary: normalize(article.summary),
  body: normalize([...article.notes, ...article.sections.flatMap(section => [section.heading, ...(section.paragraphs ?? []), ...(section.steps ?? []), ...(section.bullets ?? [])])].join(' ')),
}));

/** All query terms must match; titles and explicit keywords rank above body text. */
export function searchHelp(query: string, category?: string) {
  const normalized = normalize(query.slice(0, 180));
  const terms = [...new Set(normalized.split(' ').filter(Boolean))];
  if (!terms.length) return [];
  return index.filter(entry => !category || entry.article.category === category)
    .map(entry => {
      const fields = [[entry.title, 12], [entry.keywords, 9], [entry.category, 5], [entry.summary, 3], [entry.body, 1]] as const;
      if (!terms.every(term => fields.some(([value]) => value.includes(term)))) return { article: entry.article, score: 0 };
      return { article: entry.article, score: terms.reduce((total, term) => total + fields.reduce((sum, [value, weight]) => sum + (value.includes(term) ? weight : 0), 0), entry.title.includes(normalized) ? 20 : 0) };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .map(entry => entry.article);
}
