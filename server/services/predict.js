import * as tf from '@tensorflow/tfjs';
import path from 'path';
import { scrollWithAscSort } from './scroll';
import { deleteIndexIfExists } from './delete';
import { createIndexSortedOnTimefield } from './create';
import { machineId } from 'node-machine-id';
import { readFile } from 'fs';
import { emitProgress, serverLog } from '../utils';
import { BulkHelper } from '../BulkHelper';
import { Scrollable } from '../Scrollable';
import { reindexFromTo } from './reindex';
import { doSlidingWindowPrediction } from './do-sliding-windows-prediction';
import { promisify } from 'util';
const readFileSync = promisify(readFile);

const predict = async (req) => {

  const startTime = new Date();

  const configService = req.server.config();
  const OMAR_TIMEFIELD_PREDICT_OUTPUT = configService.get('omar.index.timefieldPredictOutputIndex');
  const OMAR_PREFIX_SORTED_INDEX = configService.get('omar.index.prefixSortedIndex');
  const OMAR_PREFIX_PREDICT_OUTPUT = configService.get('omar.index.prefixPredictOutputIndex');
  const BULK_QUEUE_THRESHOLD = req.server.config().get('omar.bulkQueueSize');
  const MODEL_PATH = configService.get('omar.model.path');
  const METADATA_PATH = path.join(MODEL_PATH, 'metadata.json');
  const PARAMS_PATH = path.join(MODEL_PATH, 'params.json');

  /*
    MODEL
    ------------
    METADATA
    PARAMS
    MODEL (model.json + weight.bin)
  */
  serverLog(req, 'info', __filename, '### RETRIEVING MODEL AND METADATA FROM TRAIN');
  emitProgress(req, 'Predict', 'Retrieving model and metadata from train', 0);
  const METADATA = JSON.parse(await readFileSync(METADATA_PATH, 'utf-8'));
  const PARAMS = JSON.parse(await readFileSync(PARAMS_PATH, 'utf-8'));
  const MODEL = await tf.loadLayersModel('file://' + MODEL_PATH + '/model.json');
  const MACHINE_ID = await machineId();
  const SORTED_INDEX = OMAR_PREFIX_SORTED_INDEX + '-' + MACHINE_ID;


  const { index, timeField, predictField, featureFields, timeStep, timeUnit } = METADATA;
  const { fieldsInformations, stats } = PARAMS;


  /*
    REINDEX
    ------------
    Sorting: index -> SORTED_INDEX
  */
  serverLog(req, 'info', __filename, '### SORTING INDEX');
  emitProgress(req, 'Predict', 'Sorting index', 0);
  await deleteIndexIfExists(req, SORTED_INDEX);
  await createIndexSortedOnTimefield(req, SORTED_INDEX, timeField);
  await reindexFromTo(req, index, SORTED_INDEX);

  if (!!+process.env.mustCancelPredict) { process.env.mustCancelPredict = "0"; return };

  /*
    SCROLL PREDICT
    ------------
    SORTED_INDEX -> index
    Sliding windows:
     - Select windows time (timeField,timeStep,timeUnit)
     - Filter on relevant fields (featureFields,predictField)
     - Normalize (stats,fieldsInformations)
     - Predict (model)
     - Index (bulkHelper)
  */
  serverLog(req, 'info', __filename, '### PREDICTING');
  emitProgress(req, 'Predict', 'Predicting', 0);
  const bulkHelperPRD = new BulkHelper(req, index, BULK_QUEUE_THRESHOLD);
  const staticArgsPRD = {
    timeField: timeField,
    timeStep: timeStep,
    timeUnit: timeUnit,
    predictField: predictField,
    featureFields: featureFields,
    fieldsInformations: fieldsInformations,
    stats: stats,
    model: MODEL,
    bulkHelper: bulkHelperPRD
  }
  const dynamicArgsPRD = {};
  const PRD = new Scrollable(req, doSlidingWindowPrediction, staticArgsPRD, dynamicArgsPRD);
  await scrollWithAscSort(req, SORTED_INDEX, 10000, timeField, PRD);

  await deleteIndexIfExists(req, SORTED_INDEX);

  const endTime = new Date();
  emitProgress(req, 'Predict', 'Predicting', 100, { elapsedTime: (endTime - startTime), endTime: endTime });

  return

}

export { predict };
