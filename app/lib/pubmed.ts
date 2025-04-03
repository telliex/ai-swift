export async function searchPubMed(query: string, maxResults = 3) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
  const searchUrl = `${baseUrl}esearch.fcgi?db=pubmed&term=${encodeURIComponent(
    query
  )}&retmode=json&retmax=${maxResults}`;

  try {
    // 搜索相關論文ID
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    const ids = searchData.esearchresult.idlist;

    if (ids.length === 0) {
      return null;
    }

    // 獲取論文摘要
    const summaryUrl = `${baseUrl}esummary.fcgi?db=pubmed&id=${ids.join(
      ','
    )}&retmode=json`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    // 整理結果
    return ids.map((id: string) => {
      const article = summaryData.result[id];
      return {
        title: article.title,
        authors:
          article.authors?.map((a: { name: string }) => a.name).join(', ') ||
          'Unknown',
        journal: article.fulljournalname,
        pubDate: article.pubdate,
        abstract: article.abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      };
    });
  } catch (error) {
    console.error('PubMed API error:', error);
    return null;
  }
}
