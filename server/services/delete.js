const deleteIndexIfExists = async (req, index) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    const indexExists = await callWithRequest(req, 'indices.exists', { index: index });

    if (indexExists) {
        await callWithRequest(req, 'indices.delete', { index: index });
    }

    return
}

export { deleteIndexIfExists };