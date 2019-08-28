import { count } from './count';
import { isQuali } from './is-quali';
import { enableBucketingOnTextField } from './enable-bucketing-on-text-field';
import { changeBucketSettings } from './change-bucket-settings';
import { clearArchivedSettings } from './clear-archive-settings';
import { getTypes } from './types';
import { getMods } from './mods';
import path from 'path';

const getFieldsInformations = async (req) => {

    let featQuanti = [];
    let featQuali = [];
    let featMods = {};
    let predMods = [];
    let inputShape = 0;

    const featureFields = req.payload.featureFields.split(',');
    const featureTypes = await getTypes(req, req.payload.index, featureFields);

    try {
        await clearArchivedSettings(req);
        await changeBucketSettings(req, 10000);
    } catch (e) {
        req.server.log(['error', 'omar', path.basename(__filename, '.js')], e);
    }

    const nDocs = await count(req);

    for (const feat of featureFields) {

        if (featureTypes[feat] === 'text') {
            try {
                await enableBucketingOnTextField(req, feat);
            } catch (e) {
                req.server.log(['error', 'omar', path.basename(__filename, '.js')], e);
            }
        }

        const fIsQuali = await isQuali(req, feat, nDocs);

        if (fIsQuali) {

            featQuali.push(feat);
            let fMods = await getMods(req, feat);
            featMods = Object.assign(featMods, { [feat]: fMods });
            inputShape += fMods.length;

        } else {

            featQuanti.push(feat);
            inputShape += 4;

        }
    };

    const { predictField } = req.payload;
    if ((await getTypes(req, req.payload.index, predictField)[predictField]) === 'text') {
        try {
            await enableBucketingOnTextField(req, feat);
        } catch (e) {
            req.server.log(['error', 'omar', path.basename(__filename, '.js')], e);
        }
    }
    const pIsQuali = await isQuali(req, predictField, nDocs);
    if (pIsQuali) {
        predMods = await getMods(req, predictField);
    }

    const result = {
        featureInformation: {
            featQuanti: featQuanti,
            featQuali: featQuali,
            featMods: featMods
        },
        predictInformation: {
            isQuali: pIsQuali,
            predMods: predMods
        },
        inputShape: inputShape
    }

    return result;
}

export { getFieldsInformations };
