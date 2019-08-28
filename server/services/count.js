import { indexRefresh } from './index-refresh';

const count = async (req, differentIndex = '') => {

    let index = '';

    differentIndex === '' ? index = req.payload.index : index = differentIndex;

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    await indexRefresh(req, index);

    const tmpDocCount = await callWithRequest(req, 'count', {
        index: index,
        body: {}
    })

    const docCount = parseInt(tmpDocCount.count);

    return docCount;
};

export { count };
