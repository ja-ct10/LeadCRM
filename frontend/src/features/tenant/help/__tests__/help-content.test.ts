import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getArticle, getCategory, getCategoryArticles, getRelatedArticles, helpArticles, helpCategories, popularArticleIds } from '../content';
import { searchHelp } from '../search';

describe('Help Center content integrity', () => {
  it('has unique, addressable articles with valid categories and related links', () => {
    expect(new Set(helpArticles.map(article => article.id)).size).toBe(helpArticles.length);
    expect(new Set(helpArticles.map(article => article.slug)).size).toBe(helpArticles.length);
    for (const article of helpArticles) {
      expect(article.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(getCategory(article.category)).toBeDefined();
      expect(article.summary.length).toBeGreaterThan(20);
      expect(article.sections.length).toBeGreaterThan(0);
      expect(article.related.length).toBeGreaterThan(0);
      expect(article.related).not.toContain(article.id);
      expect(getRelatedArticles(article.slug)).toHaveLength(article.related.length);
      for (const section of article.sections) {
        expect([...(section.steps ?? []), ...(section.bullets ?? []), ...(section.paragraphs ?? [])].length).toBeGreaterThan(0);
      }
    }
  });
  it('has populated categories and real implementation sources for maintenance', () => {
    for (const category of helpCategories) {
      expect(getCategoryArticles(category.id).length).toBeGreaterThan(0);
      for (const source of category.sources) {
        expect(existsSync(resolve(__dirname, '../../../../../../', source)), source).toBe(true);
      }
    }
    for (const slug of popularArticleIds) expect(getArticle(slug)).toBeDefined();
  });
  it('returns no record for unknown routes', () => {
    expect(getArticle('not-a-guide')).toBeUndefined();
    expect(getCategory('not-a-category')).toBeUndefined();
    expect(getRelatedArticles('not-a-guide')).toEqual([]);
  });
});

describe('Help Center search', () => {
  it.each(['create role', 'CREATING ROLE', ' create   roles '])('ranks the custom-role procedure first for %s', query => {
    expect(searchHelp(query)[0].slug).toBe('creating-roles');
  });
  it('finds phone help in leads, contacts, and profiles', () => {
    const ids = searchHelp('phone').map(article => article.id);
    expect(ids).toEqual(expect.arrayContaining(['creating-leads', 'creating-contacts', 'profile-settings']));
  });
  it('finds pipeline concepts and deal creation', () => {
    expect(searchHelp('pipeline').map(article => article.id)).toEqual(expect.arrayContaining(['pipeline-stages', 'creating-deals']));
  });
  it('searches category names, keywords, and the article body', () => {
    expect(searchHelp('troubleshooting').some(article => article.category === 'troubleshooting')).toBe(true);
    expect(searchHelp('tin').some(article => article.id === 'creating-accounts')).toBe(true);
    expect(searchHelp('9123456789').some(article => article.id === 'creating-leads')).toBe(true);
  });
  it('filters results by category and handles empty or unmatched queries', () => {
    expect(searchHelp('phone', 'contacts').every(article => article.category === 'contacts')).toBe(true);
    expect(searchHelp('phone', 'contacts').length).toBeGreaterThan(0);
    expect(searchHelp('   ')).toEqual([]);
    expect(searchHelp('!!!')).toEqual([]);
    expect(searchHelp('unfindablezqx')).toEqual([]);
    expect(searchHelp('phone', 'unknown')).toEqual([]);
  });
});
