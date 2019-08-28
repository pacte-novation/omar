import { count } from './count';
import { serverLog, sleep } from '../utils';

const reindexFromTo = async (req, from, to) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    const nDocsTotal = await count(req, from);

    try {
        await callWithRequest(req, 'reindex', {
            body: {
                source: {
                    index: from,
                    size: 10000
                },
                dest: {
                    index: to
                }
            }
        }, { keepAlive: false, requestTimeout: 10000 * 60 * 60 });

        while (true) {

            const nDocs = await count(req, to);
            const progress = nDocs / nDocsTotal * 100;

            req.io.emit('progressTrain', {
                progressTrain: progress,
                messTrain: 'Sorting index...(' + progress + ' %)',
            });

            await sleep(2000);

            if (nDocs === nDocsTotal) { break; }

            if (!!+process.env.mustCancelTrain) { return true }
        }

    } catch (error) {
        serverLog(req, 'error', __filename, error);
    }

    return true

}

export { reindexFromTo };
