import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HelpArticle } from '../content/types';
import { getRelatedArticles } from '../content';
import { HelpBreadcrumb, HelpFooter, articleHref } from './help-shared';
import styles from './help.module.css';

export default function HelpArticlePage({ article }: { article: HelpArticle }) {
  const related = getRelatedArticles(article.slug);
  const sections = article.sections.map((section, index) => ({ ...section, anchor: `section-${index + 1}` }));
  const toc = <div className={styles.tocLinks}>{sections.map(section => <a key={section.anchor} href={`#${section.anchor}`}>{section.heading}</a>)}{article.notes.length > 0 && <a href="#important-notes">Important notes</a>}<a href="#related-articles">Related articles</a></div>;
  return <div className={styles.root}>
    <HelpBreadcrumb category={article.category} title={article.title} />
    <div className={styles.articleLayout}>
      <article className={styles.article}>
        <header><h1>{article.title}</h1><p className={styles.summary}>{article.summary}</p></header>
        <details className={styles.mobileToc}><summary>On this page</summary>{toc}</details>
        {sections.map(section => <section id={section.anchor} key={section.anchor} className={styles.articleSection}><h2>{section.heading}</h2>{section.paragraphs?.map(text => <p key={text}>{text}</p>)}{section.steps && <ol>{section.steps.map(text => <li key={text}>{text}</li>)}</ol>}{section.bullets && <ul>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}</section>)}
        {article.notes.length > 0 && <aside id="important-notes" className={styles.notes} aria-labelledby="notes-heading"><h2 id="notes-heading">Important notes</h2>{article.notes.map(note => <p key={note}>{note}</p>)}</aside>}
        <section id="related-articles" className={styles.related}><h2>Related articles</h2>{related.map(item => <Link key={item.id} href={articleHref(item.slug)}><ArrowRight size={15} aria-hidden="true" />{item.title}</Link>)}</section>
      </article>
      <nav aria-label="On this page" className={styles.toc}><h2>On this page</h2>{toc}</nav>
    </div>
    <HelpFooter />
  </div>;
}
