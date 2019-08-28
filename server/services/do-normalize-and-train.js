import 'tfjs-node-save';
import { normalize, shiftAndTrain, serverLog, sleep } from '../utils';


const doNormalizeAndTrain = async (req, chunk, staticObj, dynamicObj) => {

    const { stats, fieldsInformations, batchSize, nDocsTotal } = staticObj;
    let { model } = dynamicObj;

    let nDocs = dynamicObj.nDocs ? dynamicObj.nDocs : 0;
    let xTrain = dynamicObj.xTrain ? dynamicObj.xTrain : [];
    let yTrain = dynamicObj.yTrain ? dynamicObj.yTrain : [];

    let tmpModel = {};
    let progress = 0;

    for (const doc of chunk) {

        const normalizedDoc = await normalize(doc._source, fieldsInformations, stats);

        tmpModel = await shiftAndTrain(req, model, xTrain, yTrain, normalizedDoc);
        model = tmpModel.model;
        xTrain = tmpModel.xTrain;
        yTrain = tmpModel.yTrain;

        nDocs++;

        if (nDocs % 200 === 0) {
            progress = (nDocs / nDocsTotal * 100).toFixed(0);
            serverLog(req, 'info', __filename, nDocs + '/' + nDocsTotal);
            req.io.emit('progressTrain', { ['progressTrain']: progress, ['messTrain']: 'Normalizing and training model...(' + progress + ' %)' });
            await sleep(1)
        }

        if (!!+process.env.mustCancelTrain) { return dynamicObj }

    }

    if (chunk.length != batchSize) {
        progress = 100;
        req.io.emit('progressTrain', { ['progressTrain']: progress, ['messTrain']: 'Normalizing and training model...(' + progress + ' %)' });
    }

    dynamicObj = Object.assign(dynamicObj, {
        model: model,
        xTrain: xTrain,
        yTrain: yTrain,
        nDocs: nDocs
    });

    return dynamicObj;

}

export { doNormalizeAndTrain };