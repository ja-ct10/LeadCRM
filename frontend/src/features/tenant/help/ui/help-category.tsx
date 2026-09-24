import type { HelpCategory } from '../content/types';
import { getCategoryArticles } from '../content';
import { HelpBreadcrumb, ArticleResult, HelpFooter } from './help-shared';
import styles from './help.module.css';

export default function HelpCategoryPage({ category }: { category: HelpCategory }) {
  const articles = getCategoryArticles(category.id);
  return <div className={styles.root}>
    <HelpBreadcrumb category={category.id} />
    <header className={styles.categoryHeader}><h1>{category.title}</h1><p>{category.description}</p></header>
    <section aria-label={`${category.title} articles`}><div className={styles.sectionHead}><h2>{articles.length} articles</h2></div><div className={styles.results}>{articles.map(article => <ArticleResult key={article.id} article={article} />)}</div></section>
    <HelpFooter />
  </div>;
}
