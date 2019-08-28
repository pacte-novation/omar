const createIndexSortedOnTimefield = async (req, index, timeField) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    await callWithRequest(req, 'indices.create', {
        index: index,
        body: {
            mappings: {
                properties: {
                    [timeField]: {
                        type: 'date'
                    },
                    y_pred: {
                        type: 'float'
                    }
                }
            },
            settings: {
                index: {
                    sort: {
                        field: timeField,
                        order: 'asc'
                    }
                }
            }
        }
    });

    return
}

export { createIndexSortedOnTimefield };