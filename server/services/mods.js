import path from 'path';

const getMods = async (req, field) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    const resp = await callWithRequest(req, 'search', {
        index: req.payload.index,
        body: {
            size: 0,
            aggs: {
                [field]: {
                    terms: {
                        field: field,
                        size: 10000
                    }
                }
            }
        }
    });

    const buckets = resp.aggregations[field].buckets;

    const mods = buckets.map((bucket) => {
        try {
            if (bucket['key_as_string']) {
                return JSON.parse(bucket['key_as_string']);
            } else {
                if (typeof bucket['key'] === "string") {
                    return bucket['key'].toLowerCase();
                } else {
                    return bucket['key']
                }
            }
        } catch (e) {
            req.server.log(['error', 'omar', path.basename(__filename, '.js')], e);
        }
    })

    return mods;
}

export { getMods };