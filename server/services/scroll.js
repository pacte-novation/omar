import { serverLog } from '../utils';
import { count } from './count';

const scrollWithAscSort = async (req, index, batchSize = 10000, sortField, scrollable) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    serverLog(req, 'info', __filename, "scrolling " + index);

    const nDocsTotal = await count(req, index);
    scrollable.staticArgs = Object.assign(scrollable.staticArgs, { nDocsTotal: nDocsTotal, batchSize: batchSize });

    let body = { size: batchSize, sort: { [sortField]: 'asc' } }
    let nDocs = 0;

    while (true) {

        const resp = await callWithRequest(req, 'search', { index: index, body: body });
        const chunk = resp.hits.hits;
        nDocs += chunk.length;
        body['search_after'] = chunk[chunk.length - 1].sort;

        serverLog(req, 'info', __filename, nDocs + '/' + nDocsTotal);

        await scrollable.exec(chunk);

        if (!!+process.env['mustCancelTrain']) { return scrollable.dynamicArgs }
        if (!!+process.env['mustCancelPredict']) { return scrollable.dynamicArgs }
        if (chunk.length != batchSize) { break; }

    }

    return scrollable.dynamicArgs

}

export { scrollWithAscSort };

