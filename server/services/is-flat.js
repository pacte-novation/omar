const isFlat = async (req, index, field, obj = {}) => {

    if (obj === undefined || obj === {} || obj[field] === undefined) {
        const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');
        const resp = await callWithRequest(req, 'search', { index: index, body: { size: 1, query: { exists: { field: field } } } });
        if (resp && resp.hits && resp.hits.hits && resp.hits.hits[0] && resp.hits.hits[0]._source) {
            obj = resp.hits.hits[0]._source;
        } else {
            return undefined
        }
    }

    if (obj && obj !== {} && obj[field] !== undefined) {
        const fValue = obj[field];
        return !(typeof fValue === 'object')
    } else {
        return undefined
    }

}

export { isFlat };