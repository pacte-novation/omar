import { exists, readFile } from 'fs';
import { resolve, join } from 'path';
import { promisify } from 'util';
const existSync = promisify(exists);
const readSync = promisify(readFile);

const getModelParams = async (req) => {

    const MODEL_PATH = resolve(req.server.config().get('omar.model.path'));
    const PARAMS_PATH = join(MODEL_PATH, 'metadata.json');

    const isParams = await existSync(PARAMS_PATH);
    if (isParams) {
        const params = JSON.parse((await readSync(PARAMS_PATH)).toString());
        return { currentModel: params }
    } else {
        req.server.log(['error', 'omar', 'train'], 'File: ' + PARAMS_PATH + ' not found');
    }

    return {}
}


export { getModelParams };

