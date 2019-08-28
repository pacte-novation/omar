const getTypes = async (req, index, arrFields) => {

    let result = {};

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    const resp = await callWithRequest(req, 'indices.getFieldMapping', {
        index: index,
        fields: arrFields
    });

    const { mappings } = resp[index];
    const keys = Object.keys(mappings);

    for (const key of keys) {
        if (arrFields.includes(key)) {
            result[key] = mappings[key].mapping[key].type;
        }
    }

    return result

}

export { getTypes };