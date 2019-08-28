import path from 'path';
import { doResampleAndRetrieveStats } from './do-resample-and-retrieve-stats';
import { scrollWithAscSort } from './scroll';
import { doNormalizeAndTrain } from './do-normalize-and-train';
import { getFieldsInformations } from './fields-information';
import { createIndexSortedOnTimefield } from './create';
import { reindexFromTo } from './reindex';
import { createModel } from './create-model';
import { deleteIndexIfExists } from './delete';
import { createFolderIfNotExist, serverLog } from '../utils';
import { writeFile } from 'fs';
import { promisify } from 'util';

import { machineId } from 'node-machine-id';
const writeFileSync = promisify(writeFile);
import 'tfjs-node-save';
import { BulkHelper } from '../BulkHelper';
import { Scrollable } from '../Scrollable';

const train = async (req) => {

  const startTime = new Date();

  const { index, timeField, predictField, timeStep } = req.payload;
  const featureFields = req.payload.featureFields.split(',');

  const configService = req.server.config();
  const OMAR_PREFIX_SORTED_INDEX = configService.get('omar.index.prefixSortedIndex');
  const OMAR_PREFIX_PREDICT_OUTPUT = configService.get('omar.index.prefixPredictOutputIndex');
  const MODEL_PATH = configService.get('omar.model.path');
  const BULK_QUEUE_THRESHOLD = req.server.config().get('omar.bulkQueueSize');

  const MACHINE_ID = await machineId();
  const SORTED_INDEX = OMAR_PREFIX_SORTED_INDEX + '-' + MACHINE_ID;
  const OUTPUT_INDEX = OMAR_PREFIX_PREDICT_OUTPUT + '-' + index + '-' + MACHINE_ID;

  /*
    MODALITES
    ------------
    fieldsInformations
  */
  serverLog(req, 'info', __filename, '### MODALITES');
  const fieldsInformations = await getFieldsInformations(req);
  if (fieldsInformations.predictInformation.isQuali) {
    const mess = "Le champ à prédire " + predictField + " selectionné n'est pas quantitatif"
    req.server.log(['warning', 'omar', 'train'], mess)
    req.io.emit('progressTrain', { progressTrain: 0, errorTrain: true, messTrain: mess, lastStageOfTrain: false });
    return
  }

  if (!!+process.env.mustCancelTrain) { process.env.mustCancelTrain = "0"; return }

  /*
    REINDEX
    ------------
    Sorting: index -> SORTED_INDEX
  */
  serverLog(req, 'info', __filename, '### SORTING INDEX');
  req.io.emit('progressTrain', { progressTrain: "0", messTrain: 'Sorting index...(0 %)' })
  await deleteIndexIfExists(req, SORTED_INDEX);
  await createIndexSortedOnTimefield(req, SORTED_INDEX, timeField);
  await reindexFromTo(req, index, SORTED_INDEX);

  if (!!+process.env.mustCancelTrain) { process.env.mustCancelTrain = "0"; return }

  /*
    FIRST SCROLL
    ------------
    Resampling: SORTED_INDEX -> OUTPUT_INDEX
    Retrieving statistics: stats
  */
  serverLog(req, 'info', __filename, '### RESAMPLING AND RETRIEVING GLOBAL STATISTIQUES');
  req.io.emit('progressTrain', { progressTrain: "0", messTrain: 'Resampling and retrieving statistics...(0 %)' })
  await deleteIndexIfExists(req, OUTPUT_INDEX);
  await createIndexSortedOnTimefield(req, OUTPUT_INDEX, timeField);
  const bulkHelperRARS = new BulkHelper(req, OUTPUT_INDEX, BULK_QUEUE_THRESHOLD);
  const staticArgsRARS = {
    timeUnit: 'm',
    timeStep: timeStep,
    featureFields: featureFields,
    predictField: predictField,
    timeField: timeField,
    fieldsInformations: fieldsInformations,
    bulkHelper: bulkHelperRARS,
    mustRetrieveStats: true
  }
  const dynamicArgsRARS = { stats: {} }
  const RARS = new Scrollable(req, doResampleAndRetrieveStats, staticArgsRARS, dynamicArgsRARS);
  const { stats } = await scrollWithAscSort(req, SORTED_INDEX, 10000, timeField, RARS);

  if (!!+process.env.mustCancelTrain) { process.env.mustCancelTrain = "0"; return }

  /*
    SECOND SCROLL
    ------------
    Normalize: OUTPUT_INDEX -> normalizedDoc
    Train: model
  */
  serverLog(req, 'info', __filename, '### NORMALIZE AND TRAIN ON BATCH');
  req.io.emit('progressTrain', { progressTrain: "0", messTrain: 'Normalizing and training model...(0 %)' })
  const staticArgsNAT = {
    index: OUTPUT_INDEX,
    featureFields: featureFields,
    predictField: predictField,
    timeField: timeField,
    fieldsInformations: fieldsInformations,
    stats: stats
  }
  const dynamicArgsNAT = { model: (await createModel(fieldsInformations.inputShape)) };
  const NAT = new Scrollable(req, doNormalizeAndTrain, staticArgsNAT, dynamicArgsNAT);
  const { model } = await scrollWithAscSort(req, OUTPUT_INDEX, 10000, timeField, NAT);

  if (!!+process.env.mustCancelTrain) { process.env.mustCancelTrain = "0"; return }

  /*
    SAVE
    ------------
    MODEL_PATH/model.json
    MODEL_PATH/weight.bin
    MODEL_PATH/metadata.json
    MODEL_PATH/params.json
  */
  serverLog(req, 'info', __filename, '### SAVING MODEL');
  await createFolderIfNotExist(MODEL_PATH);
  await model.save('file://' + MODEL_PATH);
  const model_metadata = {
    index: index,
    timeField: timeField,
    predictField: predictField,
    featureFields: featureFields,
    timeStep: timeStep,
    timeUnit: timeUnit
  }
  const model_params = {
    fieldsInformations: fieldsInformations,
    stats: stats
  }
  const METADATA_PATH = path.join(MODEL_PATH, 'metadata.json');
  const PARAMS_PATH = path.join(MODEL_PATH, 'params.json');
  await writeFileSync(METADATA_PATH, JSON.stringify(model_metadata, null, 4));
  await writeFileSync(PARAMS_PATH, JSON.stringify(model_params, null, 4));

  if (!!+process.env.mustCancelTrain) { process.env.mustCancelTrain = "0"; return }

  /*
    CLEAN
    ------------
    Delete SORTED_INDEX
    Delete OUTPUT_INDEX
  */
  await deleteIndexIfExists(req, SORTED_INDEX);
  await deleteIndexIfExists(req, OUTPUT_INDEX);

  const endTime = new Date();

  req.io.emit('progressTrain', { progressTrain: 100, lastStageOfTrain: true, elapsedTime: (endTime - startTime), endTime: endTime });

  return

}

export { train };