import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import moment from 'moment';
import * as tf from '@tensorflow/tfjs';

const oneHot = async (column) => {
    let oHColumns = [];
    for (const mod of column.mods) {
        let oHColumn = {
            header: column.header.toLowerCase() + '|' + mod,
            values: column.values.map(v => v.toString().toLowerCase() === mod.toString().toLowerCase() ? 1 : 0),
            mods: [0, 1]
        }
        oHColumns.push(oHColumn);
    }
    return oHColumns;
}

const createFolderIfNotExist = async (folderPath) => {
    const existsAsync = promisify(fs.exists);
    const mkdirAsync = promisify(fs.mkdir);
    const arbo = folderPath.split('/');
    let pathToCreate = arbo[0];
    for (let i = 1; i < arbo.length - 1; i++) {
        const lvl = arbo[i];
        pathToCreate += '/' + lvl;
        if (!(await existsAsync(pathToCreate))) {
            await mkdirAsync(pathToCreate);
        }
    }
}

const getMean = async (arr) => {
    const mean = arr.reduce((acc, curr) => { return acc + curr }, 0) / arr.length;
    return mean
}

const pick = async (obj, arr) => {
    let result = {};
    const keys = Object.keys(obj);
    for (let key of keys) {
        if (arr.includes(key)) {
            result[key] = obj[key];
        }
    }
    return result
}

const getSquareSum = async (arr) => {
    const ssum = arr.reduce((acc, curr) => { return acc + curr ** 2 }, 0)
    return ssum
}

const sleep = (ms) => {
    return new Promise(async (resolve) => setTimeout(resolve, ms));
}

const normalize = async (doc, fieldsInformations, stats) => {
    let normalizedDoc = {};
    const { featureInformation, predictInformation } = fieldsInformations;
    const fields = Object.keys(doc);
    for (const field of fields) {
        const [f, statType] = field.split('|');
        if (f !== '_timeField') {
            if (f === '_predictField') {
                if (predictInformation.isQuali !== true) {
                    normalizedDoc['_predictField'] = (doc['_predictField'] - stats['_predictField'].mean.min) / (stats['_predictField'].mean.max - stats['_predictField'].mean.min);
                }
            } else if (featureInformation.featQuanti.includes(f)) {
                if (statType === 'min') {
                    normalizedDoc[field] = (doc[field] - stats[f].min.min) / (stats[f].min.max - stats[f].min.min);
                } else if (statType === 'max') {
                    normalizedDoc[field] = (doc[field] - stats[f].max.min) / (stats[f].max.max - stats[f].max.min);
                } else if (statType === 'std') {
                    normalizedDoc[field] = (doc[field] - stats[f].std.min) / (stats[f].std.max - stats[f].std.min);
                } else if (statType === 'mean') {
                    normalizedDoc[field] = (doc[field] - stats[f].mean.min) / (stats[f].mean.max - stats[f].mean.min);
                }
            } else if (featureInformation.featQuali.includes(f)) {
                normalizedDoc[field] = doc[field];
            }
        }
    }
    return normalizedDoc
}

const unNormalizePredictField = async (predictField, stats) => {
    return predictField / (stats['_predictField'].mean.max - stats['_predictField'].mean.min) + stats['_predictField'].mean.min;
}

const batchToDataframe = async (batch, fieldsInformations) => {
    let df = {};
    let columns = [];
    const { featureInformation } = fieldsInformations;
    const firstBatchLine = batch[0];

    const fTime = Object.keys(firstBatchLine.time)[0];
    const vTime = batch.map(doc => doc.time[fTime]);
    const fPred = Object.keys(firstBatchLine.pred)[0];
    const vPred = batch.map(doc => doc.pred[fPred]);
    columns.push({ header: fTime, values: vTime, isTime: true })
    columns.push({ header: fPred, values: vPred, isPred: true })

    const headers = Object.keys(firstBatchLine.features);
    for (const header of headers) {
        const values = batch.map(doc => doc.features[header]);
        const isQuali = featureInformation.featQuali.includes(header);
        const mods = isQuali ? featureInformation.featMods[header] : [];
        const column = {
            header: header,
            values: values,
            isFeat: true,
            isQuali: isQuali,
            mods: mods
        }
        columns.push(column);
    }
    df.columns = columns;
    return df
}

const dataframeToStatsSample = async (df, tZero) => {
    let statsSample = {};
    statsSample['_timeField'] = moment(tZero);
    for (const column of df.columns) {
        if (column.isPred === true) {
            statsSample['_predictField'] = parseFloat(await getMean(column.values));
        } else if (column.isFeat === true) {
            if (column.isQuali === true) {
                const oHColumns = await oneHot(column);
                for (const oHColumn of oHColumns) {
                    const mean = await getMean(oHColumn.values);
                    statsSample[oHColumn.header] = parseFloat(mean);
                }
            } else {
                const min = Math.min(...column.values);
                const max = Math.max(...column.values);
                const mean = (await getMean(column.values));
                const std = Math.sqrt(1 / column.values.length * ((await getSquareSum(column.values)) - mean) ** 2);

                statsSample[column.header + '|min'] = parseFloat(min);
                statsSample[column.header + '|max'] = parseFloat(max);
                statsSample[column.header + '|mean'] = parseFloat(mean);
                statsSample[column.header + '|std'] = parseFloat(std);
            }
        }
    }
    return statsSample
}


const retrieveStatsFromDataframe = async (df, stats) => {

    for (const column of df.columns) {
        if (column.isFeat === true && column.isQuali !== true) {

            let nDocs = column.values.length;
            let min = Math.min(...column.values);
            let max = Math.max(...column.values);
            let mean = await getMean(column.values);
            let std = Math.sqrt(1 / nDocs * ((await getSquareSum(column.values)) - mean) ** 2);

            if (min < stats[column.header].min.min && min !== -Infinity) {
                stats[column.header].min.min = min;
            } else if (min > stats[column.header].min.max && min !== Infinity) {
                stats[column.header].min.max = min;
            };
            if (max < stats[column.header].max.min && max !== -Infinity) {
                stats[column.header].max.min = max;
            } else if (max > stats[column.header].max.max && max !== Infinity) {
                stats[column.header].max.max = max;
            };
            if (mean < stats[column.header].mean.min && mean !== -Infinity) {
                stats[column.header].mean.min = mean;
            } else if (mean > stats[column.header].mean.max && mean !== Infinity) {
                stats[column.header].mean.max = mean;
            };
            if (std < stats[column.header].std.min && std !== -Infinity) {
                stats[column.header].std.min = std;
            } else if (std > stats[column.header].std.max && std !== Infinity) {
                stats[column.header].std.max = std;
            };

        } else if (column.isPred === true) {

            const mean = await getMean(column.values);
            if (mean < stats['_predictField'].mean.min && mean !== -Infinity) {
                stats['_predictField'].mean.min = mean;
            } else if (mean > stats['_predictField'].mean.max && mean !== Infinity) {
                stats['_predictField'].mean.max = mean;
            };

        }
    }
    return stats
}

const shiftAndTrain = async (req, model, xTrain, yTrain, normalizedDoc) => {

    const fields = Object.keys(normalizedDoc);

    if (yTrain.length > 0) {

        yTrain = [];
        yTrain.push(normalizedDoc['_predictField']);

        console.log(yTrain)

        try {
            await model.trainOnBatch(tf.tensor([xTrain]), tf.tensor(yTrain));
        } catch (error) {
            serverLog(req, 'error', __filename, error);
        }

        xTrain = [];
        for (const field of fields) {
            if (field !== '_timeField') {
                if (field !== '_predictField') {
                    xTrain.push(normalizedDoc[field]);
                }
            }
        }

    } else {

        for (const field of fields) {
            if (field !== '_timeField') {
                if (field !== '_predictField') {
                    xTrain.push(normalizedDoc[field]);
                } else {
                    yTrain.push(normalizedDoc['_predictField']);
                }
            }
        }

    }

    return { model: model, xTrain: xTrain, yTrain: yTrain };

}

const areAllFieldsPresentInObj = async (obj, fields) => {
    const keys = Object.keys(obj);
    for (let field of fields) {
        if (!keys.includes(field)) {
            return false;
        }
    }
    return true
}

const serverLog = (req, type, filename, log) => {
    req.server.log([type, 'omar', path.basename(filename, '.js')], log);
}

const emitProgress = (req, type, message, progress, optObj = {}) => {
    const progressStr = progress.toString();
    const messObj = { ['progress' + type]: progressStr, ['mess' + type]: message + '...(' + progressStr + ' %)' };
    const socketObj = Object.assign(messObj, optObj);
    req.io.emit('progress' + type, socketObj);
}

export {
    oneHot,
    createFolderIfNotExist,
    getMean,
    getSquareSum,
    sleep,
    normalize,
    areAllFieldsPresentInObj,
    shiftAndTrain,
    retrieveStatsFromDataframe,
    dataframeToStatsSample,
    batchToDataframe,
    pick,
    serverLog,
    emitProgress,
    unNormalizePredictField
};
