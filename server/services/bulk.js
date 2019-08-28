const bulk = async (req, body, index = 'default') => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');
    try {
        await callWithRequest(req, 'bulk', {
            index: index,
            body: body
        });
    } catch (error) {
        req.server.log(['error', 'omar'], error)
    }

    return;
};

export { bulk };