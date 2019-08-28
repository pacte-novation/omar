const indexRefresh = async (req, index) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    await callWithRequest(req, 'indices.refresh', { index: index });

    return true;
};

export { indexRefresh };