const changeBucketSettings = async (req, maxBucket) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    await callWithRequest(req, 'cluster.putSettings', {
        body: {
            persistent: {
                search: {
                    max_buckets: parseInt(maxBucket)
                }
            }
        }
    });
}

export { changeBucketSettings };