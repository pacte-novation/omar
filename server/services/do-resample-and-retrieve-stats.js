import moment from 'moment';
import {
    dataframeToStatsSample,
    retrieveStatsFromDataframe,
    batchToDataframe,
    areAllFieldsPresentInObj,
    pick,
    serverLog
} from '../utils';
import { BulkItem } from '../BulkItem';


const doResampleAndRetrieveStats = async (req, chunk, staticObj, dynamicObj = {}) => {

    const { featureFields, predictField, timeField, fieldsInformations, bulkHelper, batchSize, nDocsTotal, mustRetrieveStats, timeStep, timeUnit } = staticObj;
    const { featQuanti } = fieldsInformations.featureInformation;
    let { stats } = dynamicObj;

    const relevantFieldsToCompute = [...featureFields, predictField];

    //Initialisation de dynamicObj
    if (mustRetrieveStats === true) {
        for (let feat of featQuanti) {
            if (!stats[feat]) {
                stats = Object.assign(stats, { [feat]: { min: { min: Number.MAX_VALUE, max: Number.MIN_VALUE }, max: { min: Number.MAX_VALUE, max: Number.MIN_VALUE }, mean: { min: Number.MAX_VALUE, max: Number.MIN_VALUE }, std: { min: Number.MAX_VALUE, max: Number.MIN_VALUE } } });
            }
        }
        if (!stats['_predictField']) {
            stats = Object.assign(stats, { ['_predictField']: { mean: { min: Number.MAX_VALUE, max: Number.MIN_VALUE } } });
        }
    }


    let tmpBatch = dynamicObj.tmpBatch ? dynamicObj.tmpBatch : [];
    let tZero = dynamicObj.tZero ? dynamicObj.tZero : chunk[0]._source[timeField];
    let nProcessedDocs = dynamicObj.nProcessedDocs ? dynamicObj.nProcessedDocs : 0;
    let progress = 0;

    for (const doc of chunk) {

        if (await areAllFieldsPresentInObj(doc._source, relevantFieldsToCompute)) {

            // On ajoute le document au batch en cours de construction
            if (moment(doc._source[timeField]) < moment(tZero).add(timeStep, timeUnit)) {

                tmpBatch.push({
                    time: { [timeField]: doc._source[timeField] },
                    features: (await pick(doc._source, featureFields)),
                    pred: { [predictField]: doc._source[predictField] }
                });

                // Le document courant est en dehors du scope du batch en cours: on termine le batch en cours en réalisant les calculs et on ajoute le document dans le batch suivant
            } else {

                const df = await batchToDataframe(tmpBatch, fieldsInformations);
                if (mustRetrieveStats === true) {
                    stats = await retrieveStatsFromDataframe(df, stats);
                }
                const statsSample = await dataframeToStatsSample(df, tZero);
                const bulkItem = new BulkItem('index', statsSample);
                await bulkHelper.addBulkItem(bulkItem.toStr());


                if (bulkHelper.bulkQueueSize >= bulkHelper.bulkQueueThreshold) {
                    try {
                        await bulkHelper.send();
                    } catch (error) {
                        serverLog(req, 'error', __filename, error);
                    }
                }


                tmpBatch = [];
                tmpBatch.push({
                    time: { [timeField]: doc._source[timeField] },
                    features: (await pick(doc._source, featureFields)),
                    pred: { [predictField]: doc._source[predictField] }
                });
                tZero = moment(tZero).add(timeStep, timeUnit);
            };

        }

        nProcessedDocs++;

        if (nProcessedDocs % 1000 === 0) {
            progress = (nProcessedDocs / nDocsTotal * 100).toFixed(0);
            serverLog(req, 'info', __filename, nProcessedDocs + '/' + nDocsTotal);
            req.io.emit('progressTrain', { ['progressTrain']: progress, ['messTrain']: 'Resampling and retrieving statistics...(' + progress + ' %)' })
        }

        if (!!+process.env.mustCancelTrain) { return dynamicObj }

    };

    if (batchSize !== chunk.length) {
        progress = "100";
        try {
            await bulkHelper.send();
        } catch (error) {
            serverLog(req, 'error', __filename, error);
        }
        serverLog(req, 'info', __filename, nProcessedDocs + '/' + nDocsTotal);
        req.io.emit('progressTrain', { ['progressTrain']: progress, ['messTrain']: 'Resampling and retrieving statistics...(' + progress + ' %)' })
    }

    dynamicObj = Object.assign(dynamicObj, {
        tmpBatch: tmpBatch,
        tZero: tZero,
        nProcessedDocs: nProcessedDocs,
        stats: stats
    });

    return dynamicObj;
}

export { doResampleAndRetrieveStats };