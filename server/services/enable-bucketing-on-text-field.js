import { serverLog } from '../utils';

const enableBucketingOnTextField = async (req, field) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    try {
        await callWithRequest(req, 'indices.putMapping', {
            index: req.payload.index,
            body: {
                properties: {
                    [field]: {
                        type: "text",
                        fielddata: true
                    }
                }
            }
        })
    } catch (error) {
        serverLog(req, 'error', __filename, error);
    }
}

export { enableBucketingOnTextField };

