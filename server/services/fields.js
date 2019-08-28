import { isFlat } from './is-flat';

const getFields = async (req, obj = { bOtherIndex: false }) => {

  if (!(req.params && req.params.index)) { req.params = req.payload; }

  const index = obj.bOtherIndex === false ? req.params.index : obj.index;

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

  const resp = await callWithRequest(req, 'indices.getMapping', { index: index });
  const oProps = resp[index].mappings.properties;
  const fArr = Object.keys(oProps);
  const call = await callWithRequest(req, 'search', {
    index: index,
    body: {
      size: 1,
      query: {
        exists: {
          field: fArr[0]
        }
      }
    }
  });
  const refDoc = call.hits.hits[0]._source;
  const fields = await Promise.all(
    fArr.map(async (key) => ({ field: key, type: oProps[key].type, isFlat: (await isFlat(req, index, key, refDoc)) }))
  );

  const fNoDate = [];
  const fDate = [];
  for (const f of fields) {
    if (f.isFlat) {
      if (f.type === 'date') {
        fDate.push(f.field);
      } else {
        fNoDate.push(f.field);
      }
    }
  }
  fNoDate.sort();
  fDate.sort();

  const result = { fNoDate: fNoDate, fDate: fDate, fields: fields }

  return result
}


export { getFields };

