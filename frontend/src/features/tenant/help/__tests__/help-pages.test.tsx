import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getArticle, getCategory, getCategoryArticles, getRelatedArticles, helpCategories, popularArticleIds } from '../content';
import ArticleRoute, { generateStaticParams as articleParams } from '../../../../../app/help/articles/[slug]/page';
import CategoryRoute, { generateStaticParams as categoryParams } from '../../../../../app/help/category/[slug]/page';
import HelpHome from '../ui/help-home';
import HelpArticlePage from '../ui/help-article';
import HelpCategoryPage from '../ui/help-category';

const navigation = vi.hoisted(() => ({ query: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  useRouter: () => ({ replace: navigation.replace }),
  notFound: () => { throw new Error('Not found'); },
}));
beforeEach(() => { vi.spyOn(window.history, 'replaceState').mockImplementation(navigation.replace); });
afterEach(() => { cleanup(); navigation.query = ''; vi.restoreAllMocks(); vi.clearAllMocks(); });

it('renders home with labelled search, popular links, and categories', () => {
  render(<HelpHome />);
  expect(screen.getByRole('heading', { level: 1, name: 'How can we help?' })).toBeTruthy();
  expect(screen.getByRole('searchbox', { name: 'Search LeadCRM help' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Creating a Custom Role' }).getAttribute('href')).toBe('/help/articles/creating-roles');
  expect(screen.getByRole('link', { name: /Leads Capture prospects/ }).getAttribute('href')).toBe('/help/category/leads');
  for (const category of helpCategories) {
    expect(screen.getByRole('heading', { name: category.title }).closest('a')?.getAttribute('href')).toBe(`/help/category/${category.id}`);
  }
  for (const slug of popularArticleIds) {
    expect(screen.getByRole('link', { name: getArticle(slug)!.title }).getAttribute('href')).toBe(`/help/articles/${slug}`);
  }
});
it('renders deep-linked search results and a category filter', () => {
  navigation.query = 'q=create+role';
  render(<HelpHome />);
  expect(screen.getByRole('status').textContent).toContain('articles for “create role”');
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/help/articles/creating-roles');
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'roles' } });
  expect(navigation.replace).toHaveBeenCalledWith(null, '', '/help?q=create+role&category=roles');
});
it('offers recovery from an empty result and restores focus', () => {
  navigation.query = 'q=unfindablezqx';
  render(<HelpHome />);
  expect(screen.getByText('No matching articles')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search and browse all guides' }));
  expect(navigation.replace).toHaveBeenCalledWith(null, '', '/help');
  expect(document.activeElement).toBe(screen.getByRole('searchbox'));
});
it('renders category articles and a home breadcrumb', () => {
  render(<HelpCategoryPage category={getCategory('leads')!} />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Leads');
  expect(screen.getByRole('link', { name: 'Help Center' }).getAttribute('href')).toBe('/help');
  expect(screen.getByRole('heading', { name: 'Creating a Lead' })).toBeTruthy();
});
it('renders the existing Roles & Permissions landing page and its seven article destinations', () => {
  render(<HelpCategoryPage category={getCategory('roles')!} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Roles & Permissions' })).toBeTruthy();
  const articles = getCategoryArticles('roles');
  expect(articles).toHaveLength(7);
  for (const article of articles) expect(screen.getByRole('heading', { name: article.title }).closest('a')?.getAttribute('href')).toBe(`/help/articles/${article.slug}`);
});
it('renders article steps, notes, working anchors, and every related link', () => {
  const article = getArticle('creating-leads')!;
  const { container } = render(<HelpArticlePage article={article} />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(article.title);
  expect(container.querySelector('ol')).toBeTruthy();
  expect(screen.getByText(/stored as \+639123456789/)).toBeTruthy();
  for (const related of getRelatedArticles(article.slug)) expect(screen.getByRole('link', { name: related.title }).getAttribute('href')).toBe(`/help/articles/${related.slug}`);
  for (const anchor of container.querySelectorAll('a[href^="#"]')) expect(container.querySelector(anchor.getAttribute('href')!)).toBeTruthy();
  expect(container.querySelector('details summary')?.textContent).toBe('On this page');
});
it.each(helpCategories.map(category => category.id))('resolves the %s category route', async slug => {
  expect(categoryParams()).toContainEqual({ slug });
  render(await CategoryRoute({ params: Promise.resolve({ slug }) }));
  expect(screen.getByRole('heading', { level: 1, name: getCategory(slug)!.title })).toBeTruthy();
});
it.each(['products', 'inbox', 'email-activity', 'conversion-funnel', 'understanding-roles'])('resolves /help/articles/%s and its related destinations', async slug => {
  expect(articleParams()).toContainEqual({ slug });
  render(await ArticleRoute({ params: Promise.resolve({ slug }) }));
  expect(screen.getByRole('heading', { level: 1, name: getArticle(slug)!.title })).toBeTruthy();
  for (const related of getRelatedArticles(slug)) {
    expect(screen.getByRole('link', { name: related.title }).getAttribute('href')).toBe(`/help/articles/${related.slug}`);
  }
});
it('uses the existing not-found behavior for a retired article', async () => {
  await expect(ArticleRoute({ params: Promise.resolve({ slug: 'deal-table' }) })).rejects.toThrow('Not found');
});
