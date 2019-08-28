
const getIndices = async (req) => {

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');
  const resp = await callWithRequest(req, 'cat.indices', { format: "json" });
  const result = resp
    .filter(el => (el.status == "open" && !el.index.startsWith(".")))
    .map(el => ({ index: el.index, count: el['docs.count'] }))
    .sort((a, b) => (a.index < b.index ? -1 : 1));

  return result

}

export { getIndices };