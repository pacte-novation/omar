import { bulk } from './services/bulk';
import { serverLog } from './utils';

export class BulkHelper {

    constructor(req, bulkOutputIndex, bulkQueueThreshold = 500) {
        this._req = req;
        this._bulkOutputIndex = bulkOutputIndex;
        this._bulkQueueThreshold = bulkQueueThreshold;
        this._bulkQueue = [];
    }

    async addBulkItem(bulkItemStr) {
        this._bulkQueue.push(bulkItemStr);
    }

    get bulkQueueSize() {
        return this._bulkQueue.length;
    }

    get bulkQueueThreshold() {
        return this._bulkQueueThreshold;
    }

    async send() {

        if (this.bulkQueueSize > 0) {
            try {
                await bulk(this._req, this._bulkQueue.join('\n'), this._bulkOutputIndex);
            } catch (error) {
                serverLog(this._req, 'error', __filename, error);
            }

            this._bulkQueue = [];
        }

    }

}
