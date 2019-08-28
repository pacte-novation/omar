import moment from 'moment';
import {
    batchToDataframe,
    normalize,
    dataframeToStatsSample,
    areAllFieldsPresentInObj,
    emitProgress,
    serverLog,
    pick,
    unNormalizePredictField
} from '../utils';
import * as tf from '@tensorflow/tfjs';
import { BulkItem } from '../BulkItem';


const doSlidingWindowPrediction = async (req, chunk, staticObj, dynamicObj = {}) => {

    const { featureFields, predictField, timeField, timeUnit, timeStep, fieldsInformations, stats, model, nDocsTotal, batchSize, bulkHelper } = staticObj;

    const relevantFields = [...featureFields, predictField, timeField];

    let window = dynamicObj.window ? dynamicObj.window : { values: [], windowStartTime: null, windowEndTime: null };
    let nProcessedDocs = dynamicObj.nProcessedDocs ? dynamicObj.nProcessedDocs : 0;
    let chunkPart = dynamicObj.chunkPart ? dynamicObj.chunkPart : [];


    chunk = chunkPart.concat(chunk);

    for (let i = 0; i < chunk.length; i++) {

        let iDoc = chunk[i]._source;
        let iDocId = chunk[i]._id;

        if (await areAllFieldsPresentInObj(iDoc, relevantFields)) {

            window.values = [];
            window.windowStartTime = moment(iDoc[timeField]);
            window.windowEndTime = moment(window.windowStartTime).add(timeStep, timeUnit);

            let isWindowComplete = false;
            for (let j = i; j < chunk.length; j++) {

                let jDoc = chunk[j]._source;

                if (await areAllFieldsPresentInObj(jDoc, relevantFields)) {

                    if (moment(jDoc[timeField]) <= window.windowEndTime) {

                        window.values.push({
                            time: { [timeField]: jDoc[timeField] },
                            features: (await pick(jDoc, featureFields)),
                            pred: { [predictField]: jDoc[predictField] }
                        });

                    } else {

                        const df = await batchToDataframe(window.values, fieldsInformations);
                        const statsSample = await dataframeToStatsSample(df, window.windowStartTime);
                        delete statsSample._predictField;
                        const normalizedStatsSample = await normalize(statsSample, fieldsInformations, stats);
                        const xPredict = tf.tensor([Object.values(normalizedStatsSample)]);
                        const yPredict = await unNormalizePredictField(await model.predict(xPredict).dataSync()[0], stats);

                        const bulkItem = new BulkItem("update", { doc: { "omar-predict": yPredict } }, iDocId);
                        await bulkHelper.addBulkItem(bulkItem.toStr());

                        isWindowComplete = true;
                        break;

                    }

                }

            }

            if (isWindowComplete !== true) {
                window.values = [];
                window.windowStartTime = null
                window.windowEndTime = null
                chunkPart = chunk.slice(i);
                break;
            }

        }

        if (bulkHelper.bulkQueueSize >= bulkHelper.bulkQueueThreshold) {
            try {
                await bulkHelper.send();
            } catch (error) {
                serverLog(req, 'error', __filename, error);
            }
        }

        nProcessedDocs++;

        if (nProcessedDocs % 1000 === 0) {
            let progress = (nProcessedDocs / nDocsTotal * 100).toFixed(0);
            serverLog(req, 'info', __filename, nProcessedDocs + '/' + nDocsTotal);
            emitProgress(req, 'Predict', 'Predicting', progress);
        }

        if (!!+process.env.mustCancelPredict) { return dynamicObj }

    }

    if (batchSize !== chunk.length) {
        let progress = "100";
        try {
            await bulkHelper.send();
        } catch (error) {
            serverLog(req, 'error', __filename, error);
        }
        serverLog(req, 'info', __filename, nProcessedDocs + '/' + nDocsTotal);
        emitProgress(req, 'Predict', 'Predicting', progress);
    }

    dynamicObj = Object.assign(dynamicObj, {
        window: window,
        chunkPart: chunkPart,
        nProcessedDocs: nProcessedDocs
    });

    return dynamicObj;

}

export { doSlidingWindowPrediction };