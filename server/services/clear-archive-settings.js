const clearArchivedSettings = async (req) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    await callWithRequest(req, 'cluster.putSettings', {
        body: {
            transient: {
                "archived.*": null
            }
        }
    });
}

export { clearArchivedSettings };