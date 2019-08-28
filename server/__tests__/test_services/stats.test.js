import { getStats } from "../../services/stats";

import expect from "@kbn/expect";

describe("stat", () => {
    it("tests the output of the function", async () => {
        const input =
            [
                {
                    _index: 'hitachi-real-time',
                    _type: '_doc',
                    _id: '2',
                    _score: 1,
                    _source:
                    {
                        is_failure: 0,
                        y_pred: 2
                    }
                },
                {
                    _index: 'hitachi-real-time',
                    _type: '_doc',
                    _id: '3',
                    _score: 1,
                    _source:
                    {
                        is_failure: 0,
                        y_pred: 3
                    }
                },
                {
                    _index: 'hitachi-real-time',
                    _type: '_doc',
                    _id: '4',
                    _score: 1,
                    _source:
                    {
                        is_failure: 0,
                        y_pred: 4
                    }
                }]

        const expected =
        {
            nDocs: 3,
            y_pred:
            {
                min: 2,
                max: 4,
                mean: 3,
                std: 0.8164965809277257,
                meanQuad: 29
            }
        }

        let obj = {}

        const output = await getStats(1, input, obj);

        expect(JSON.stringify(output)).to.equal(JSON.stringify(expected));
    });
});